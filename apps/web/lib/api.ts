import { createClient } from '@/lib/supabase/client';
import type {
  Device,
  DeviceGroup,
  DeviceCommand,
  DeviceAlert,
  CommandType,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function getAuthHeaders(): Promise<HeadersInit> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

async function fetchApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  devices: {
    list: () => fetchApi<Device[]>('/devices'),
    get: (id: string, withToken?: boolean) =>
      fetchApi<Device & { agentToken?: string }>(`/devices/${id}${withToken ? '?token=true' : ''}`),
    create: (body: {
      name: string;
      deviceName?: string;
      androidVersion?: string;
      cpu?: number;
      ram?: number;
      storage?: number;
      deviceSerial?: string;
      groupId?: string;
      type?: 'emulator' | 'physical';
      osVersion?: string;
      metadata?: Record<string, unknown>;
    }) => fetchApi<Device>('/devices', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<Device>) =>
      fetchApi<Device>(`/devices/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) =>
      fetchApi<void>(`/devices/${id}`, { method: 'DELETE' }),
    regenerateToken: (id: string) =>
      fetchApi<{ token: string }>(`/devices/${id}/regenerate-token`, { method: 'POST' }),
    start: (id: string) => fetchApi<Device>(`/devices/${id}/start`, { method: 'POST' }),
    stop: (id: string) => fetchApi<Device>(`/devices/${id}/stop`, { method: 'POST' }),
    restart: (id: string) => fetchApi<Device>(`/devices/${id}/restart`, { method: 'POST' }),
  },
  billing: {
    getSubscription: () => fetchApi<{ status: string; deviceLimit: number; currentPeriodEnd: string | null } | null>('/billing/subscription'),
    createCheckout: (successUrl: string, cancelUrl: string) =>
      fetchApi<{ url: string }>('/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ successUrl, cancelUrl }),
      }),
    createPortal: (returnUrl: string) =>
      fetchApi<{ url: string }>('/billing/portal', {
        method: 'POST',
        body: JSON.stringify({ returnUrl }),
      }),
  },
  groups: {
    list: () => fetchApi<DeviceGroup[]>('/devices/groups'),
    create: (name: string) =>
      fetchApi<DeviceGroup>('/devices/groups', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    update: (id: string, name: string) =>
      fetchApi<DeviceGroup>(`/devices/groups/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      }),
    delete: (id: string) =>
      fetchApi<void>(`/devices/groups/${id}`, { method: 'DELETE' }),
  },
  commands: {
    list: (limit?: number) =>
      fetchApi<DeviceCommand[]>(`/devices/commands${limit ? `?limit=${limit}` : ''}`),
    create: (body: {
      commandType: CommandType;
      payload?: Record<string, unknown>;
      targetType: 'device' | 'group';
      targetIds: string[];
    }) =>
      fetchApi<DeviceCommand>('/devices/commands', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },
  alerts: {
    list: (all?: boolean) =>
      fetchApi<DeviceAlert[]>(`/devices/alerts${all ? '?all=true' : ''}`),
    resolve: (id: string) =>
      fetchApi<void>(`/devices/alerts/${id}/resolve`, { method: 'POST' }),
  },
};
