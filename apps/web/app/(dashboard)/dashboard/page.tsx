'use client';

import { api } from '@/lib/api';
import type { Device } from '@/lib/types';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

export default function DashboardHomePage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [subscription, setSubscription] = useState<{ status: string; deviceLimit: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([
        api.devices.list(),
        api.billing.getSubscription(),
      ]);
      setDevices(d);
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

  const running = devices.filter((d) => d.status === 'running' || d.status === 'online').length;
  const total = devices.length;

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
      <h1 className="font-display text-2xl font-bold text-slate-900">Dashboard</h1>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-medium text-slate-500">Total devices</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-medium text-slate-500">Running</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{running}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-medium text-slate-500">Device limit</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{subscription?.deviceLimit ?? 1}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-medium text-slate-500">Subscription</p>
          <p className="mt-2 text-lg font-semibold capitalize text-slate-900">{subscription?.status ?? 'None'}</p>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-slate-900">Recent devices</h2>
          <Link
            href="/dashboard/devices"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            View all
          </Link>
        </div>
        <div className="mt-4">
          {devices.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
              No devices yet. Create one to get started.
            </p>
          ) : (
            <ul className="space-y-2">
              {devices.slice(0, 5).map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/dashboard/devices/${d.id}`}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-900">{d.name}</span>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                      d.status === 'running' || d.status === 'online' ? 'bg-emerald-100 text-emerald-700' :
                      d.status === 'starting' ? 'bg-amber-100 text-amber-700' :
                      d.status === 'error' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {d.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
