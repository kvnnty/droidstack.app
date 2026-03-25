import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import { SupabaseService } from '../supabase/supabase.service';

const PRICE_PER_DEVICE = process.env.STRIPE_PRICE_PER_DEVICE ?? '';

@Injectable()
export class BillingService {
  private stripe: Stripe;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly orchestrator: OrchestratorService,
  ) {
    const key = process.env.STRIPE_SECRET_KEY;
    this.stripe = new Stripe(key ?? 'sk_test_placeholder');
  }

  private getClient() {
    return this.supabase.getClient();
  }

  async getOrCreateCustomer(userId: string, email: string): Promise<string> {
    const { data: existing } = await this.getClient()
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) return existing.stripe_customer_id;

    const customer = await this.stripe.customers.create({
      email: email || undefined,
      metadata: { userId },
    });

    await this.getClient()
      .from('stripe_customers')
      .insert({ user_id: userId, stripe_customer_id: customer.id });

    return customer.id;
  }

  async getSubscription(userId: string): Promise<{
    status: string;
    deviceLimit: number;
    currentPeriodEnd: string | null;
    stripeSubscriptionId: string | null;
  } | null> {
    const { data } = await this.getClient()
      .from('stripe_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;
    return {
      status: data.status,
      deviceLimit: data.device_limit ?? 1,
      currentPeriodEnd: data.current_period_end,
      stripeSubscriptionId: data.stripe_subscription_id,
    };
  }

  async canCreateDevice(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const sub = await this.getSubscription(userId);
    const { count } = await this.getClient()
      .from('devices')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['starting', 'running']);

    const limit = sub?.deviceLimit ?? 1;
    if ((count ?? 0) >= limit) {
      return { allowed: false, reason: `Device limit reached (${limit}). Upgrade your plan.` };
    }
    if (sub && sub.status !== 'active' && sub.status !== 'trialing') {
      return { allowed: false, reason: 'Subscription inactive. Please update billing.' };
    }
    return { allowed: true };
  }

  /** Limits active/running devices in an organization to the org owner's subscription. */
  async canCreateDeviceInOrg(
    ownerUserId: string,
    organizationId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const sub = await this.getSubscription(ownerUserId);
    const { count } = await this.getClient()
      .from('devices')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .in('status', ['starting', 'running']);

    const limit = sub?.deviceLimit ?? 1;
    if ((count ?? 0) >= limit) {
      return { allowed: false, reason: `Device limit reached (${limit}). Upgrade your plan.` };
    }
    if (sub && sub.status !== 'active' && sub.status !== 'trialing') {
      return { allowed: false, reason: 'Subscription inactive. Please update billing.' };
    }
    return { allowed: true };
  }

  async createCheckoutSession(userId: string, email: string, successUrl: string, cancelUrl: string): Promise<string> {
    if (!PRICE_PER_DEVICE) throw new Error('STRIPE_PRICE_PER_DEVICE not configured');
    const customerId = await this.getOrCreateCustomer(userId, email);
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: PRICE_PER_DEVICE, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId },
      subscription_data: { metadata: { userId } },
    });
    return session.url ?? '';
  }

  async createPortalSession(userId: string, returnUrl: string): Promise<string> {
    const { data } = await this.getClient()
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    if (!data) throw new Error('No billing account');

    const session = await this.stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: returnUrl,
    });
    return session.url ?? '';
  }

  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET required');

    const event = this.stripe.webhooks.constructEvent(payload, signature, secret);

    switch (event.type) {
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoiceFailed(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.deleted':
      case 'customer.subscription.updated':
        await this.handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const inv = invoice as { subscription?: string | { id: string } };
    const subId = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id;
    if (!subId) return;
    const sub = await this.stripe.subscriptions.retrieve(subId);
    const userId = sub.metadata?.userId;
    if (!userId) return;
    const periodEnd = (sub as { current_period_end?: number }).current_period_end;

    await this.getClient()
      .from('stripe_subscriptions')
      .upsert({
        user_id: userId,
        stripe_subscription_id: sub.id,
        status: sub.status,
        device_limit: 1,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'stripe_subscription_id' });
  }

  private async handleInvoiceFailed(invoice: Stripe.Invoice): Promise<void> {
    const inv = invoice as { subscription?: string | { id: string } };
    const subId = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id;
    if (!subId) return;
    await this.getClient()
      .from('stripe_subscriptions')
      .update({ status: 'past_due', updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', subId);
  }

  private async handleSubscriptionChange(sub: Stripe.Subscription): Promise<void> {
    const userId = sub.metadata?.userId;
    if (!userId) return;

    if (sub.status === 'canceled' || sub.status === 'unpaid') {
      await this.getClient()
        .from('stripe_subscriptions')
        .update({ status: sub.status, updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', sub.id);

      await this.stopAllUserDevices(userId);
    } else {
      const periodEnd = (sub as { current_period_end?: number }).current_period_end;
      await this.getClient()
        .from('stripe_subscriptions')
        .upsert({
          user_id: userId,
          stripe_subscription_id: sub.id,
          status: sub.status,
          device_limit: 1,
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'stripe_subscription_id' });
    }
  }

  private async stopAllUserDevices(userId: string): Promise<void> {
    const { data: ownedOrgs } = await this.getClient()
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .eq('role', 'owner');

    const orgIds = (ownedOrgs ?? []).map((r) => r.organization_id as string);
    if (orgIds.length === 0) return;

    const { data: devices } = await this.getClient()
      .from('devices')
      .select('id, container_id')
      .in('organization_id', orgIds)
      .not('container_id', 'is', null);

    for (const d of devices ?? []) {
      try {
        await this.orchestrator.stopContainer(d.container_id as string);
      } catch {
        // ignore
      }
      await this.getClient()
        .from('devices')
        .update({
          status: 'stopped',
          container_id: null,
          adb_port: null,
          novnc_port: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', d.id);
    }
  }
}
