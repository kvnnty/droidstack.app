#!/usr/bin/env node
/**
 * Droidstack device agent
 *
 * Polls the API for commands and executes them on the enrolled device.
 * Android: ADB on the host that can reach the device/emulator.
 * iOS: reserved — set DEVICE_HOST_PLATFORM=ios to exercise the stub path until implemented.
 *
 * Env:
 *   API_URL - Backend API URL (default: http://localhost:3001)
 *   DEVICE_ID - Device UUID from dashboard
 *   DEVICE_TOKEN - API key for device auth (from dashboard)
 *   DEVICE_HOST_PLATFORM - android | ios (default: android)
 *   ADB_SERIAL - ADB device serial when platform is android (default: emulator-5554)
 */

import { execSync } from 'child_process';

type DeviceHostPlatform = 'android' | 'ios';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';
const DEVICE_ID = process.env.DEVICE_ID ?? '';
const DEVICE_TOKEN = process.env.DEVICE_TOKEN ?? '';
const ADB_SERIAL = process.env.ADB_SERIAL ?? 'emulator-5554';
const POLL_INTERVAL_MS = 5000;

function resolveHostPlatform(raw: string | undefined): DeviceHostPlatform {
  const v = (raw ?? 'android').toLowerCase();
  return v === 'ios' ? 'ios' : 'android';
}

const HOST_PLATFORM = resolveHostPlatform(process.env.DEVICE_HOST_PLATFORM);

const adb = (cmd: string): string => {
  const serial = ADB_SERIAL ? `-s ${ADB_SERIAL}` : '';
  return execSync(`adb ${serial} ${cmd}`, { encoding: 'utf-8' });
};

async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Device-Token': DEVICE_TOKEN ?? '',
    ...(options.headers as Record<string, string>),
  };
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function getBatteryLevelAndroid(): Promise<number | null> {
  try {
    const out = adb('shell dumpsys battery');
    const m = out.match(/level:\s*(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  } catch {
    return null;
  }
}

async function heartbeat(): Promise<void> {
  if (!DEVICE_ID || !DEVICE_TOKEN) return;
  try {
    const battery =
      HOST_PLATFORM === 'ios'
        ? null
        : await getBatteryLevelAndroid();
    await api(`/agent/devices/${DEVICE_ID}/heartbeat`, {
      method: 'POST',
      body: JSON.stringify({ batteryLevel: battery ?? undefined, metadata: {} }),
    });
    if (battery != null && battery < 15) {
      await api(`/agent/devices/${DEVICE_ID}/alerts`, {
        method: 'POST',
        body: JSON.stringify({
          alertType: 'low_battery',
          message: `Battery at ${battery}%`,
          severity: battery < 5 ? 'critical' : 'warning',
        }),
      });
    }
  } catch (e) {
    console.error('[heartbeat]', e);
  }
}

async function getPendingCommands(): Promise<Array<{ id: string; commandType: string; payload?: Record<string, unknown> }>> {
  if (!DEVICE_ID || !DEVICE_TOKEN) return [];
  try {
    const data = await api<{ commands: Array<{ id: string; commandType: string; payload?: Record<string, unknown> }> }>(
      `/agent/devices/${DEVICE_ID}/commands`
    );
    return data?.commands ?? [];
  } catch (e) {
    console.error('[getPendingCommands]', e);
    return [];
  }
}

async function completeCommand(commandId: string, success: boolean, result?: Record<string, unknown>): Promise<void> {
  if (!DEVICE_ID || !DEVICE_TOKEN) return;
  try {
    await api(`/agent/commands/${commandId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ success, result }),
    });
  } catch (e) {
    console.error('[completeCommand]', e);
  }
}

async function executeCommandAndroid(cmd: {
  id: string;
  commandType: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const { id, commandType, payload = {} } = cmd;
  console.log(`[execute] ${commandType}`, payload);

  try {
    switch (commandType) {
      case 'screenshot': {
        const path = `/sdcard/screenshot_${Date.now()}.png`;
        adb(`shell screencap -p ${path}`);
        return completeCommand(id, true, { path });
      }
      case 'screen_record': {
        const path = `/sdcard/record_${Date.now()}.mp4`;
        const duration = (payload.duration as number) ?? 10;
        adb(`shell screenrecord --time-limit ${duration} ${path}`);
        return completeCommand(id, true, { path });
      }
      case 'install_app': {
        const url = payload.url as string;
        if (!url) throw new Error('Missing url');
        const apk = `/tmp/app_${Date.now()}.apk`;
        execSync(`curl -sL "${url}" -o ${apk}`, { stdio: 'inherit' });
        adb(`install -r ${apk}`);
        execSync(`rm -f ${apk}`);
        return completeCommand(id, true);
      }
      case 'uninstall_app': {
        const pkg = payload.packageName as string;
        if (!pkg) throw new Error('Missing packageName');
        adb(`uninstall ${pkg}`);
        return completeCommand(id, true);
      }
      case 'reboot': {
        adb('reboot');
        return completeCommand(id, true);
      }
      case 'shell': {
        const command = payload.command as string;
        if (!command) throw new Error('Missing command');
        const out = adb(`shell ${command}`);
        return completeCommand(id, true, { output: out });
      }
      case 'push_notification': {
        const msg = payload.message as string;
        if (!msg) throw new Error('Missing message');
        adb(`shell "am broadcast -a android.intent.action.BOOT_COMPLETED -e msg '${msg}'"`);
        return completeCommand(id, true);
      }
      default:
        throw new Error(`Unknown command: ${commandType}`);
    }
  } catch (e) {
    console.error('[execute]', e);
    completeCommand(id, false, { error: String(e) });
  }
}

async function executeCommandIosStub(cmd: {
  id: string;
  commandType: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  console.warn(`[execute][ios stub] ${cmd.commandType} — not implemented`, cmd.payload ?? {});
  await completeCommand(cmd.id, false, { error: 'iOS agent not implemented yet' });
}

async function executeCommand(cmd: {
  id: string;
  commandType: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  if (HOST_PLATFORM === 'ios') {
    return executeCommandIosStub(cmd);
  }
  return executeCommandAndroid(cmd);
}

async function main(): Promise<void> {
  if (!DEVICE_ID || !DEVICE_TOKEN) {
    console.error('Set DEVICE_ID and DEVICE_TOKEN in environment');
    process.exit(1);
  }

  console.log('[agent] Starting...', { API_URL, DEVICE_ID, ADB_SERIAL, HOST_PLATFORM });
  if (HOST_PLATFORM === 'ios') {
    console.warn('[agent] iOS command execution is not implemented; heartbeats run without device metrics.');
  }

  setInterval(heartbeat, 30000);
  heartbeat();

  while (true) {
    try {
      const commands = await getPendingCommands();
      for (const cmd of commands) {
        await executeCommand(cmd);
      }
    } catch (e) {
      console.error('[poll]', e);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main();
