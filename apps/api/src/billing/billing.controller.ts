import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('subscription')
  @UseGuards(SupabaseAuthGuard)
  async getSubscription(@CurrentUser() user: User) {
    return this.billing.getSubscription(user.id);
  }

  @Post('checkout')
  @UseGuards(SupabaseAuthGuard)
  async createCheckout(@CurrentUser() user: User, @Body() body: { successUrl: string; cancelUrl: string }) {
    const url = await this.billing.createCheckoutSession(
      user.id,
      user.email ?? '',
      body.successUrl,
      body.cancelUrl
    );
    return { url };
  }

  @Post('portal')
  @UseGuards(SupabaseAuthGuard)
  async createPortal(@CurrentUser() user: User, @Body() body: { returnUrl: string }) {
    const url = await this.billing.createPortalSession(user.id, body.returnUrl);
    return { url };
  }

  @Post('webhook')
  async webhook(@Req() req: Request & { rawBody?: Buffer }) {
    const sig = req.headers['stripe-signature'] as string;
    const payload = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    await this.billing.handleWebhook(payload, sig);
    return { received: true };
  }
}
