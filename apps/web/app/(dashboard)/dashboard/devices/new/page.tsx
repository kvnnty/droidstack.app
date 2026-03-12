'use client';

import { api } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function NewDevicePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const device = await api.devices.create({
        name: name.trim(),
        deviceName: name.trim(),
        androidVersion: '13',
        cpu: 2,
        ram: 2048,
        storage: 8192,
      });
      router.push(`/dashboard/devices/${device.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create device');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <Link href="/dashboard/devices" className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to devices
      </Link>
      <h1 className="mt-6 font-display text-2xl font-bold text-slate-900">Create device</h1>
      <p className="mt-2 text-slate-600">
        A new virtual Android device will be created. This may take a minute to start.
      </p>

      {error && (
        <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="mt-8">
        <label className="block text-sm font-medium text-slate-700">Device name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Android device"
          required
          className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3"
        />
        <div className="mt-6 flex gap-3">
          <Link
            href="/dashboard/devices"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create device'}
          </button>
        </div>
      </form>
    </main>
  );
}
