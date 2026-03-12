import { Injectable } from '@nestjs/common';
import type {
  Device,
  DeviceGroup,
  DeviceCommand,
  DeviceAlert,
  CommandType,
} from '@aliremote/shared';
import { BillingService } from '../billing/billing.service';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import { SupabaseService } from '../supabase/supabase.service';

function mapDevice(row: Record<string, unknown>): Device & { containerId?: string; deviceName?: string; adbPort?: number; novncPort?: number } {
  const meta = (row.metadata as Record<string, unknown>) ?? {};
  const ports = meta.ports as { adb?: number; novnc?: number } | undefined;
  return {
    id: row.id as string,
    userId: row.user_id as string,
    groupId: row.group_id as string | undefined,
    name: row.name as string,
    deviceName: (row.device_name as string) ?? row.name as string,
    deviceSerial: row.device_serial as string | undefined,
    status: row.status as Device['status'],
    type: row.type as Device['type'],
    osVersion: row.os_version as string | undefined,
    metadata: meta,
    batteryLevel: row.battery_level as number | undefined,
    lastSeenAt: row.last_seen_at as string | undefined,
    ports: ports ?? undefined,
    containerId: row.container_id as string | undefined,
    adbPort: row.adb_port as number | undefined,
    novncPort: row.novnc_port as number | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapGroup(row: Record<string, unknown>): DeviceGroup {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    deviceCount: row.device_count as number | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapCommand(row: Record<string, unknown>): DeviceCommand {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    commandType: row.command_type as CommandType,
    payload: (row.payload as Record<string, unknown>) ?? {},
    targetType: row.target_type as 'device' | 'group',
    targetIds: row.target_ids as string[],
    status: row.status as DeviceCommand['status'],
    result: row.result as Record<string, unknown> | undefined,
    createdAt: row.created_at as string,
    completedAt: row.completed_at as string | undefined,
  };
}

function mapAlert(row: Record<string, unknown>): DeviceAlert {
  return {
    id: row.id as string,
    deviceId: row.device_id as string,
    alertType: row.alert_type as DeviceAlert['alertType'],
    message: row.message as string | undefined,
    severity: row.severity as DeviceAlert['severity'],
    createdAt: row.created_at as string,
    resolvedAt: row.resolved_at as string | undefined,
  };
}

@Injectable()
export class DevicesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly orchestrator: OrchestratorService,
    private readonly billing: BillingService,
  ) {}

  private getClient() {
    return this.supabase.getClient();
  }

  async listDevices(userId: string): Promise<Device[]> {
    const { data, error } = await this.getClient()
      .from('devices')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []).map(mapDevice);
  }

  async getDevice(userId: string, id: string): Promise<Device | null> {
    const { data, error } = await this.getClient()
      .from('devices')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapDevice(data) : null;
  }

  generateAgentToken(): string {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars[Math.floor(Math.random() * chars.length)];
    }
    return token;
  }

  async createDevice(
    userId: string,
    body: {
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
    }
  ): Promise<Device> {
    const canCreate = await this.billing.canCreateDevice(userId);
    if (!canCreate.allowed) throw new Error(canCreate.reason ?? 'Cannot create device');

    const agentToken = this.generateAgentToken();
    const { data: inserted, error } = await this.getClient()
      .from('devices')
      .insert({
        user_id: userId,
        name: body.name,
        device_name: body.deviceName ?? body.name,
        android_version: body.androidVersion ?? '13',
        cpu: body.cpu ?? 2,
        ram: body.ram ?? 2048,
        storage: body.storage ?? 8192,
        device_serial: body.deviceSerial,
        group_id: body.groupId,
        type: body.type ?? 'emulator',
        os_version: body.osVersion,
        status: 'starting',
        metadata: body.metadata ?? {},
        agent_token: agentToken,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    try {
      const { containerId, adbPort, novncPort } = await this.orchestrator.startContainer(inserted.id);
      await this.getClient()
        .from('devices')
        .update({
          container_id: containerId,
          adb_port: adbPort,
          novnc_port: novncPort,
          status: 'running',
          updated_at: new Date().toISOString(),
          metadata: { ...(inserted.metadata as object ?? {}), ports: { adb: adbPort, novnc: novncPort } },
        })
        .eq('id', inserted.id);

      await this.auditLog(inserted.id, userId, 'create', { containerId, adbPort, novncPort });
    } catch (e) {
      await this.getClient()
        .from('devices')
        .update({ status: 'error', updated_at: new Date().toISOString() })
        .eq('id', inserted.id);
      throw e;
    }

    const { data: updated } = await this.getClient()
      .from('devices')
      .select('*')
      .eq('id', inserted.id)
      .single();
    return mapDevice(updated ?? inserted);
  }

  private async auditLog(deviceId: string, userId: string, action: string, payload?: object): Promise<void> {
    await this.getClient()
      .from('device_audit_logs')
      .insert({ device_id: deviceId, user_id: userId, action, payload: payload ?? {} });
  }

  async startDevice(userId: string, deviceId: string): Promise<Device> {
    const device = await this.getDevice(userId, deviceId);
    if (!device) throw new Error('Device not found');
    const d = await this.getClient().from('devices').select('container_id').eq('id', deviceId).eq('user_id', userId).single();
    if (d.data?.container_id) throw new Error('Device already running');

    const canCreate = await this.billing.canCreateDevice(userId);
    if (!canCreate.allowed) throw new Error(canCreate.reason ?? 'Cannot start device');

    await this.getClient()
      .from('devices')
      .update({ status: 'starting', updated_at: new Date().toISOString() })
      .eq('id', deviceId)
      .eq('user_id', userId);

    try {
      const { containerId, adbPort, novncPort } = await this.orchestrator.startContainer(deviceId);
      const meta = (device.metadata ?? {}) as Record<string, unknown>;
      await this.getClient()
        .from('devices')
        .update({
          container_id: containerId,
          adb_port: adbPort,
          novnc_port: novncPort,
          status: 'running',
          updated_at: new Date().toISOString(),
          metadata: { ...meta, ports: { adb: adbPort, novnc: novncPort } },
        })
        .eq('id', deviceId)
        .eq('user_id', userId);

      await this.auditLog(deviceId, userId, 'start', { containerId });
    } catch (e) {
      await this.getClient()
        .from('devices')
        .update({ status: 'error', updated_at: new Date().toISOString() })
        .eq('id', deviceId)
        .eq('user_id', userId);
      throw e;
    }

    const { data } = await this.getClient()
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .single();
    return mapDevice(data!);
  }

  async stopDevice(userId: string, deviceId: string): Promise<Device> {
    const { data } = await this.getClient()
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .eq('user_id', userId)
      .single();

    if (!data) throw new Error('Device not found');
    const containerId = data.container_id as string | null;
    if (!containerId) {
      await this.getClient()
        .from('devices')
        .update({ status: 'stopped', updated_at: new Date().toISOString() })
        .eq('id', deviceId);
    } else {
      await this.orchestrator.stopContainer(containerId);
      await this.getClient()
        .from('devices')
        .update({
          status: 'stopped',
          container_id: null,
          adb_port: null,
          novnc_port: null,
          updated_at: new Date().toISOString(),
          metadata: { ...(data.metadata as object ?? {}), ports: null },
        })
        .eq('id', deviceId)
        .eq('user_id', userId);
    }

    await this.auditLog(deviceId, userId, 'stop');
    const { data: updated } = await this.getClient()
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .single();
    return mapDevice(updated ?? data);
  }

  async restartDevice(userId: string, deviceId: string): Promise<Device> {
    const { data } = await this.getClient()
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .eq('user_id', userId)
      .single();

    if (!data) throw new Error('Device not found');
    const containerId = data.container_id as string | null;
    if (!containerId) throw new Error('Device not running');

    await this.orchestrator.restartContainer(containerId);
    await this.auditLog(deviceId, userId, 'restart');
    return mapDevice(data);
  }

  async regenerateAgentToken(userId: string, deviceId: string): Promise<string> {
    const token = this.generateAgentToken();
    const { error } = await this.getClient()
      .from('devices')
      .update({ agent_token: token })
      .eq('id', deviceId)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    return token;
  }

  async getDeviceWithToken(userId: string, id: string): Promise<(Device & { agentToken?: string }) | null> {
    const { data, error } = await this.getClient()
      .from('devices')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;
    const device = mapDevice(data);
    return { ...device, agentToken: data.agent_token as string };
  }

  async updateDevice(
    userId: string,
    id: string,
    updates: Partial<{
      name: string;
      groupId: string | null;
      status: Device['status'];
      batteryLevel: number | null;
      metadata: Record<string, unknown>;
    }>
  ): Promise<Device> {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.name != null) payload.name = updates.name;
    if (updates.groupId !== undefined) payload.group_id = updates.groupId;
    if (updates.status != null) payload.status = updates.status;
    if (updates.batteryLevel !== undefined) payload.battery_level = updates.batteryLevel;
    if (updates.metadata != null) {
      const { data: current } = await this.getClient()
        .from('devices')
        .select('metadata')
        .eq('id', id)
        .eq('user_id', userId)
        .single();
      const merged = { ...(current?.metadata as object ?? {}), ...updates.metadata };
      payload.metadata = merged;
    }

    const { data, error } = await this.getClient()
      .from('devices')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapDevice(data);
  }

  async deleteDevice(userId: string, id: string): Promise<void> {
    const { data } = await this.getClient()
      .from('devices')
      .select('container_id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (data?.container_id) {
      try {
        await this.orchestrator.stopContainer(data.container_id as string);
      } catch {
        // ignore
      }
    }

    await this.auditLog(id, userId, 'delete');
    const { error } = await this.getClient()
      .from('devices')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
  }

  async heartbeat(userId: string, deviceId: string, data?: { batteryLevel?: number; metadata?: Record<string, unknown> }): Promise<void> {
    const payload: Record<string, unknown> = {
      last_seen_at: new Date().toISOString(),
      status: 'online',
      updated_at: new Date().toISOString(),
    };
    if (data?.batteryLevel != null) payload.battery_level = data.batteryLevel;
    if (data?.metadata) payload.metadata = data.metadata;

    await this.getClient()
      .from('devices')
      .update(payload)
      .eq('id', deviceId)
      .eq('user_id', userId);
  }

  // --- Groups ---
  async listGroups(userId: string): Promise<DeviceGroup[]> {
    const { data, error } = await this.getClient()
      .from('device_groups')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw new Error(error.message);

    const groups = (data ?? []).map(mapGroup);
    for (const g of groups) {
      const { count } = await this.getClient()
        .from('devices')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', g.id);
      (g as DeviceGroup & { deviceCount?: number }).deviceCount = count ?? 0;
    }
    return groups;
  }

  async createGroup(userId: string, name: string): Promise<DeviceGroup> {
    const { data, error } = await this.getClient()
      .from('device_groups')
      .insert({ user_id: userId, name })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapGroup(data);
  }

  async updateGroup(userId: string, id: string, name: string): Promise<DeviceGroup> {
    const { data, error } = await this.getClient()
      .from('device_groups')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapGroup(data);
  }

  async deleteGroup(userId: string, id: string): Promise<void> {
    await this.getClient()
      .from('devices')
      .update({ group_id: null })
      .eq('group_id', id);

    const { error } = await this.getClient()
      .from('device_groups')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
  }

  // --- Commands ---
  async listCommands(userId: string, limit = 50): Promise<DeviceCommand[]> {
    const { data, error } = await this.getClient()
      .from('device_commands')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return (data ?? []).map(mapCommand);
  }

  async createCommand(
    userId: string,
    body: {
      commandType: CommandType;
      payload?: Record<string, unknown>;
      targetType: 'device' | 'group';
      targetIds: string[];
    }
  ): Promise<DeviceCommand> {
    const { data, error } = await this.getClient()
      .from('device_commands')
      .insert({
        user_id: userId,
        command_type: body.commandType,
        payload: body.payload ?? {},
        target_type: body.targetType,
        target_ids: body.targetIds,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapCommand(data);
  }

  // --- Alerts ---
  async listAlerts(userId: string, unresolvedOnly = true): Promise<DeviceAlert[]> {
    const deviceIds = (
      await this.getClient()
        .from('devices')
        .select('id')
        .eq('user_id', userId)
    ).data?.map((d) => d.id) ?? [];

    if (deviceIds.length === 0) return [];

    let query = this.getClient()
      .from('device_alerts')
      .select('*')
      .in('device_id', deviceIds)
      .order('created_at', { ascending: false })
      .limit(100);

    if (unresolvedOnly) {
      query = query.is('resolved_at', null);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    return (data ?? []).map(mapAlert);
  }

  async resolveAlert(userId: string, alertId: string): Promise<void> {
    const deviceIds = (
      await this.getClient()
        .from('devices')
        .select('id')
        .eq('user_id', userId)
    ).data?.map((d) => d.id) ?? [];

    const { data: alert } = await this.getClient()
      .from('device_alerts')
      .select('id')
      .eq('id', alertId)
      .in('device_id', deviceIds)
      .maybeSingle();

    if (!alert) throw new Error('Alert not found');

    const { error } = await this.getClient()
      .from('device_alerts')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', alertId);

    if (error) throw new Error(error.message);
  }

  async createAlert(
    deviceId: string,
    body: { alertType: DeviceAlert['alertType']; message?: string; severity?: DeviceAlert['severity'] }
  ): Promise<DeviceAlert> {
    const { data, error } = await this.getClient()
      .from('device_alerts')
      .insert({
        device_id: deviceId,
        alert_type: body.alertType,
        message: body.message,
        severity: body.severity ?? 'info',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapAlert(data);
  }
}
