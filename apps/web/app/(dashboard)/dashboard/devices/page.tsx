'use client';

import { api } from '@/lib/api';
import { canManageDevices, useOrg } from '@/lib/org-context';
import type { Device } from '@/lib/types';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const STATUS_STYLES: Record<string, string> = {
  running: 'bg-emerald-100 text-emerald-700',
  online: 'bg-emerald-100 text-emerald-700',
  starting: 'bg-amber-100 text-amber-700',
  stopped: 'bg-slate-100 text-slate-600',
  offline: 'bg-slate-100 text-slate-600',
  error: 'bg-red-100 text-red-700',
};

export default function DevicesPage() {
  const { currentOrg } = useOrg();
  const manageDevices = canManageDevices(currentOrg?.role);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const d = await api.devices.list();
      setDevices(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAction = async (id: string, action: 'start' | 'stop' | 'restart') => {
    setActionLoading(id);
    setError(null);
    try {
      if (action === 'start') await api.devices.start(id);
      else if (action === 'stop') await api.devices.stop(id);
      else await api.devices.restart(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionLoading(null);
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
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-slate-900">Devices</h1>
        <Link
          href="/dashboard/devices/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Create device
        </Link>
      </div>

      {error && (
        <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mt-8">
        {devices.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
            <p className="text-slate-600">No devices in this organization{manageDevices ? ' yet' : ' are assigned to you'}.</p>
            {manageDevices && (
              <Link
                href="/dashboard/devices/new"
                className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Create your first device
              </Link>
            )}
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {devices.map((d) => (
              <li
                key={d.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <Link
                      href={`/dashboard/devices/${d.id}`}
                      className="font-display font-semibold text-slate-900 hover:underline"
                    >
                      {d.name}
                    </Link>
                    <p className="mt-1 text-sm text-slate-500">
                      {d.androidVersion ?? 'Android 13'} · {d.cpu ?? 2} CPU · {(d.ram ?? 2048) / 1024}GB RAM
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[d.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {d.status}
                  </span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/dashboard/devices/${d.id}`}
                    className="flex-1 rounded-lg border border-slate-200 py-2 text-center text-sm font-medium hover:bg-slate-50"
                  >
                    View
                  </Link>
                  {(d.status === 'running' || d.status === 'online') && (
                    <>
                      <button
                        onClick={() => handleAction(d.id, 'restart')}
                        disabled={actionLoading === d.id}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                      >
                        Restart
                      </button>
                      <button
                        onClick={() => handleAction(d.id, 'stop')}
                        disabled={actionLoading === d.id}
                        className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Stop
                      </button>
                    </>
                  )}
                  {(d.status === 'stopped' || d.status === 'offline' || d.status === 'error') && (
                    <button
                      onClick={() => handleAction(d.id, 'start')}
                      disabled={actionLoading === d.id}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {actionLoading === d.id ? '...' : 'Start'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
