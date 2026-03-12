'use client';

import { api } from '@/lib/api';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

export default function BillingPage() {
  const [subscription, setSubscription] = useState<{
    status: string;
    deviceLimit: number;
    currentPeriodEnd: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api.billing.getSubscription();
      setSubscription(s ?? null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubscribe = async () => {
    setCheckoutLoading(true);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { url } = await api.billing.createCheckout(
        `${origin}/dashboard/billing?success=true`,
        `${origin}/dashboard/billing?canceled=true`
      );
      if (url) window.location.href = url;
    } catch (e) {
      console.error(e);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handlePortal = async () => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { url } = await api.billing.createPortal(`${origin}/dashboard/billing`);
      if (url) window.location.href = url;
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-center gap-2 text-slate-600">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          Loading...
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="font-display text-2xl font-bold text-slate-900">Billing</h1>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-8">
        <h2 className="font-display text-lg font-semibold text-slate-900">Current subscription</h2>
        {subscription && subscription.status === 'active' ? (
          <div className="mt-4 space-y-2">
            <p className="text-slate-600">
              Status: <span className="font-medium text-emerald-600">{subscription.status}</span>
            </p>
            <p className="text-slate-600">Device limit: {subscription.deviceLimit}</p>
            {subscription.currentPeriodEnd && (
              <p className="text-slate-600">
                Current period ends: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}
            <button
              onClick={handlePortal}
              className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Manage subscription
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-slate-600">No active subscription.</p>
            <p className="mt-2 text-sm text-slate-500">
              Subscribe to create and run virtual Android devices. $10 per device per month.
            </p>
            <button
              onClick={handleSubscribe}
              disabled={checkoutLoading}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {checkoutLoading ? 'Redirecting...' : 'Subscribe'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
