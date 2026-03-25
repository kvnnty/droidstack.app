'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { api } from '@/lib/api';
import { canManageDevices, useOrg } from '@/lib/org-context';
import type { DeviceHostPlatform } from '@/lib/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function NewDevicePage() {
  const router = useRouter();
  const { currentOrg } = useOrg();
  const [name, setName] = useState('');
  const [hostPlatform, setHostPlatform] = useState<DeviceHostPlatform>('android');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentOrg && !canManageDevices(currentOrg.role)) {
      router.replace('/dashboard/devices');
    }
  }, [currentOrg, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const device = await api.devices.create({
        name: name.trim(),
        deviceName: name.trim(),
        hostPlatform,
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
      <Button variant="link" className="h-auto p-0 text-slate-500 hover:text-slate-700" asChild>
        <Link href="/dashboard/devices">← Back to devices</Link>
      </Button>
      <h1 className="mt-6 font-display text-2xl font-bold text-slate-900">Create device</h1>
      <p className="mt-2 text-slate-600">
        Spin up a remote device. Choose the host type for the agent that will connect to it.
      </p>

      {error && (
        <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="host-platform">Device type</Label>
          <p className="text-xs text-slate-500">Which platform the enrolled device runs.</p>
          <ToggleGroup
            id="host-platform"
            type="single"
            variant="outline"
            value={hostPlatform}
            onValueChange={(v) => {
              if (v === 'android' || v === 'ios') setHostPlatform(v);
            }}
            className="w-full justify-stretch sm:w-auto"
          >
            <ToggleGroupItem value="android" aria-label="Android" className="min-w-0 flex-1 sm:flex-initial">
              Android
            </ToggleGroupItem>
            <ToggleGroupItem value="ios" disabled aria-label="iOS (coming soon)" className="min-w-0 flex-1 sm:flex-initial">
              iOS
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="space-y-2">
          <Label htmlFor="device-name">Device name</Label>
          <Input
            id="device-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Android device"
            required
            autoComplete="off"
          />
        </div>

        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href="/dashboard/devices">Cancel</Link>
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create device'}
          </Button>
        </div>
      </form>
    </main>
  );
}
