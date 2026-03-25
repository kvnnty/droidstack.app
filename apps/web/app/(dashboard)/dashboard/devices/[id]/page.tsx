'use client';

import { api } from '@/lib/api';
import { canManageDevices, useOrg } from '@/lib/org-context';
import type { Device } from '@/lib/types';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

const STATUS_COLORS: Record<string, string> = {
  online: 'bg-emerald-500',
  offline: 'bg-slate-400',
  busy: 'bg-amber-500',
  error: 'bg-red-500',
};

export default function DeviceDetailPage() {
  const params = useParams();
  const { currentOrg } = useOrg();
  const manageDevices = canManageDevices(currentOrg?.role);
  const id = params.id as string;
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commandType, setCommandType] = useState<string>('screenshot');
  const [commandPayload, setCommandPayload] = useState('');

  const [agentToken, setAgentToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const d = await api.devices.get(id, false);
      setDevice(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStart = async () => {
    try {
      await api.devices.start(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start');
    }
  };

  const handleStop = async () => {
    try {
      await api.devices.stop(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to stop');
    }
  };

  const handleRestart = async () => {
    try {
      await api.devices.restart(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to restart');
    }
  };

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let payload: Record<string, unknown> = {};
      if (commandType === 'install_app' && commandPayload) payload = { url: commandPayload };
      else if (commandType === 'uninstall_app' && commandPayload) payload = { packageName: commandPayload };
      else if (commandType === 'shell' && commandPayload) payload = { command: commandPayload };
      else if (commandType === 'push_notification' && commandPayload) payload = { message: commandPayload };
      await api.commands.create({
        commandType: commandType as Parameters<typeof api.commands.create>[0]['commandType'],
        payload: Object.keys(payload).length ? payload : undefined,
        targetType: 'device',
        targetIds: [id],
      });
      setCommandPayload('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send command');
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

  if (!device) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <p className="text-slate-600">Device not found</p>
        <Link href="/dashboard" className="mt-4 inline-block text-blue-600 hover:underline">
          Back to dashboard
        </Link>
      </main>
    );
  }

  const metaPorts = device.metadata?.ports as { novnc?: number } | undefined;
  const novncPort = metaPorts?.novnc ?? device.ports?.novnc ?? device.novncPort;
  const orchestratorHost = process.env.NEXT_PUBLIC_ORCHESTRATOR_HOST ?? 'localhost';

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/devices" className="text-slate-500 hover:text-slate-700">
            ← Devices
          </Link>
          <h1 className="font-display text-2xl font-bold text-slate-900">{device.name}</h1>
          <span
            className={`h-3 w-3 rounded-full ${STATUS_COLORS[device.status] ?? 'bg-slate-400'}`}
            title={device.status}
          />
        </div>
        <div className="flex gap-2">
          {(device.status === 'running' || device.status === 'online') && (
            <>
              <button
                onClick={handleRestart}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Restart
              </button>
              <button
                onClick={handleStop}
                className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Stop
              </button>
            </>
          )}
          {(device.status === 'stopped' || device.status === 'offline' || device.status === 'error') && (
            <button
              onClick={handleStart}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Start
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 px-4 py-2">
            <h2 className="font-display text-sm font-semibold text-slate-900">Screen</h2>
            {novncPort ? (
              <a
                href={`http://${orchestratorHost}:${novncPort}/vnc.html`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                Open in new tab
              </a>
            ) : null}
          </div>
          <div className="flex aspect-video items-center justify-center rounded-b-xl border border-slate-200 bg-slate-900">
            {novncPort ? (
              <iframe
                src={`http://${orchestratorHost}:${novncPort}/vnc.html`}
                className="h-full w-full"
                title="Device screen"
              />
            ) : (
              <div className="text-center text-slate-400">
                <p className="text-lg">No VNC available</p>
                <p className="mt-1 text-sm">
                  For emulators, add <code className="rounded bg-slate-800 px-1">ports.novnc</code> to device metadata.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {manageDevices && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="font-display text-sm font-semibold text-slate-900">Agent setup</h2>
              <p className="mt-2 text-sm text-slate-500">
                Run the agent on the host with ADB access to the device.
              </p>
              {agentToken ? (
                <pre className="mt-2 overflow-x-auto rounded bg-slate-100 p-3 text-xs">
                  {`DEVICE_ID=${device.id} \\
DEVICE_TOKEN=${agentToken} \\
ADB_SERIAL=emulator-5554 \\
API_URL=${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'} \\
pnpm --filter @droidstack/agent dev`}
                </pre>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const d = await api.devices.get(id, true);
                        const t = (d as Device & { agentToken?: string }).agentToken;
                        if (t) setAgentToken(t);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'Failed to load token');
                      }
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                  >
                    Show install command
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const { token } = await api.devices.regenerateToken(id);
                        setAgentToken(token);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'Failed');
                      }
                    }}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Regenerate agent token
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-display text-sm font-semibold text-slate-900">Device info</h2>
            <p className="mt-1 text-xs text-slate-500">
              Add <code className="rounded bg-slate-100 px-1">metadata.ports.novnc</code> (e.g. 6080) for noVNC.
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-slate-500">Status</dt>
                <dd className="font-medium">{device.status}</dd>
              </div>
              {device.batteryLevel != null && (
                <div>
                  <dt className="text-slate-500">Battery</dt>
                  <dd className="font-medium">{device.batteryLevel}%</dd>
                </div>
              )}
              {device.osVersion && (
                <div>
                  <dt className="text-slate-500">OS</dt>
                  <dd className="font-medium">{device.osVersion}</dd>
                </div>
              )}
              <div>
                <dt className="text-slate-500">Type</dt>
                <dd className="font-medium">{device.type}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-display text-sm font-semibold text-slate-900">Quick actions</h2>
            <form onSubmit={handleCommand} className="mt-3">
              <select
                value={commandType}
                onChange={(e) => setCommandType(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="screenshot">Screenshot</option>
                <option value="screen_record">Screen record</option>
                <option value="install_app">Install app</option>
                <option value="uninstall_app">Uninstall app</option>
                <option value="reboot">Reboot</option>
                <option value="shell">Shell</option>
                <option value="push_notification">Push notification</option>
              </select>
              {(commandType === 'install_app' ||
                commandType === 'uninstall_app' ||
                commandType === 'shell' ||
                commandType === 'push_notification') && (
                <input
                  type="text"
                  value={commandPayload}
                  onChange={(e) => setCommandPayload(e.target.value)}
                  placeholder={
                    commandType === 'install_app'
                      ? 'APK URL'
                      : commandType === 'uninstall_app'
                        ? 'Package name'
                        : commandType === 'push_notification'
                          ? 'Message'
                          : 'Command'
                  }
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              )}
              <button
                type="submit"
                className="mt-3 w-full rounded-lg bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Send command
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
