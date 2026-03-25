import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  Device,
  DeviceGroup,
  DeviceCommand,
  DeviceAlert,
  CommandType,
  DeviceHostPlatform,
} from '@droidstack/shared';
import { BillingService } from '../billing/billing.service';
import type { OrgRequestContext, OrgRole } from '../organizations/organizations.types';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import { SupabaseService } from '../supabase/supabase.service';

function mapDevice(row: Record<string, unknown>): Device & { containerId?: string; deviceName?: string; adbPort?: number; novncPort?: number } {
  const meta = (row.metadata as Record<string, unknown>) ?? {};
  const ports = meta.ports as { adb?: number; novnc?: number } | undefined;
  const hp = meta.hostPlatform;
  const hostPlatform =
    hp === 'android' || hp === 'ios' ? hp : undefined;
  return {
    id: row.id as string,
    userId: row.user_id as string,
    organizationId: row.organization_id as string | undefined,
    groupId: row.group_id as string | undefined,
    name: row.name as string,
    deviceName: (row.device_name as string) ?? row.name as string,
    deviceSerial: row.device_serial as string | undefined,
    status: row.status as Device['status'],
    type: row.type as Device['type'],
    osVersion: row.os_version as string | undefined,
    hostPlatform,
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
    organizationId: row.organization_id as string | undefined,
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

  private managesDevices(role: OrgRole): boolean {
    return role === 'owner' || role === 'admin';
  }

  private async assertDeviceAccess(ctx: OrgRequestContext, deviceId: string): Promise<void> {
    const { data: dev } = await this.getClient()
      .from('devices')
      .select('id')
      .eq('id', deviceId)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle();

    if (!dev) throw new NotFoundException('Device not found');

    if (this.managesDevices(ctx.role)) return;

    const { data: grant } = await this.getClient()
      .from('organization_member_device_access')
      .select('device_id')
      .eq('organization_id', ctx.organizationId)
      .eq('user_id', ctx.userId)
      .eq('device_id', deviceId)
      .maybeSingle();

    if (!grant) throw new ForbiddenException('No access to this device');
  }

  private async assertGroupInOrg(ctx: OrgRequestContext, groupId: string): Promise<void> {
    const { data } = await this.getClient()
      .from('device_groups')
      .select('id')
      .eq('id', groupId)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle();

    if (!data) throw new NotFoundException('Group not found');
  }

  private async accessibleDeviceIds(ctx: OrgRequestContext): Promise<string[] | null> {
    if (this.managesDevices(ctx.role)) return null;

    const { data, error } = await this.getClient()
      .from('organization_member_device_access')
      .select('device_id')
      .eq('organization_id', ctx.organizationId)
      .eq('user_id', ctx.userId);

    if (error) throw new Error(error.message);
    return (data ?? []).map((r: { device_id: string }) => r.device_id);
  }

  async listDevices(ctx: OrgRequestContext): Promise<Device[]> {
    const ids = await this.accessibleDeviceIds(ctx);
    let query = this.getClient()
      .from('devices')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .order('updated_at', { ascending: false });

    if (ids) {
      if (ids.length === 0) return [];
      query = query.in('id', ids);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapDevice);
  }

  async getDevice(ctx: OrgRequestContext, id: string): Promise<Device | null> {
    const { data, error } = await this.getClient()
      .from('devices')
      .select('*')
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;
    await this.assertDeviceAccess(ctx, id);
    return mapDevice(data);
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
    ctx: OrgRequestContext,
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
      hostPlatform?: DeviceHostPlatform;
      metadata?: Record<string, unknown>;
    },
  ): Promise<Device> {
    if (!this.managesDevices(ctx.role)) {
      throw new ForbiddenException('Only administrators can create devices');
    }

    if (body.groupId) {
      await this.assertGroupInOrg(ctx, body.groupId);
    }

    const canCreate = await this.billing.canCreateDeviceInOrg(ctx.ownerUserId, ctx.organizationId);
    if (!canCreate.allowed) throw new Error(canCreate.reason ?? 'Cannot create device');

    const hostPlatform = body.hostPlatform ?? 'android';
    if (hostPlatform === 'ios') {
      throw new BadRequestException('iOS device enrollment is not available yet');
    }

    const metadata = {
      ...(body.metadata ?? {}),
      hostPlatform,
    };

    const agentToken = this.generateAgentToken();
    const { data: inserted, error } = await this.getClient()
      .from('devices')
      .insert({
        user_id: ctx.ownerUserId,
        organization_id: ctx.organizationId,
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
        metadata,
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

      await this.auditLog(inserted.id, ctx.userId, 'create', { containerId, adbPort, novncPort });
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

  async startDevice(ctx: OrgRequestContext, deviceId: string): Promise<Device> {
    await this.assertDeviceAccess(ctx, deviceId);
    const device = await this.getDevice(ctx, deviceId);
    if (!device) throw new NotFoundException('Device not found');

    const d = await this.getClient()
      .from('devices')
      .select('container_id')
      .eq('id', deviceId)
      .eq('organization_id', ctx.organizationId)
      .single();

    if (d.data?.container_id) throw new Error('Device already running');

    const canCreate = await this.billing.canCreateDeviceInOrg(ctx.ownerUserId, ctx.organizationId);
    if (!canCreate.allowed) throw new Error(canCreate.reason ?? 'Cannot start device');

    await this.getClient()
      .from('devices')
      .update({ status: 'starting', updated_at: new Date().toISOString() })
      .eq('id', deviceId)
      .eq('organization_id', ctx.organizationId);

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
        .eq('organization_id', ctx.organizationId);

      await this.auditLog(deviceId, ctx.userId, 'start', { containerId });
    } catch (e) {
      await this.getClient()
        .from('devices')
        .update({ status: 'error', updated_at: new Date().toISOString() })
        .eq('id', deviceId)
        .eq('organization_id', ctx.organizationId);
      throw e;
    }

    const { data } = await this.getClient()
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .single();
    return mapDevice(data!);
  }

  async stopDevice(ctx: OrgRequestContext, deviceId: string): Promise<Device> {
    await this.assertDeviceAccess(ctx, deviceId);

    const { data } = await this.getClient()
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .eq('organization_id', ctx.organizationId)
      .single();

    if (!data) throw new NotFoundException('Device not found');
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
        .eq('organization_id', ctx.organizationId);
    }

    await this.auditLog(deviceId, ctx.userId, 'stop');
    const { data: updated } = await this.getClient()
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .single();
    return mapDevice(updated ?? data);
  }

  async restartDevice(ctx: OrgRequestContext, deviceId: string): Promise<Device> {
    await this.assertDeviceAccess(ctx, deviceId);

    const { data } = await this.getClient()
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .eq('organization_id', ctx.organizationId)
      .single();

    if (!data) throw new NotFoundException('Device not found');
    const containerId = data.container_id as string | null;
    if (!containerId) throw new Error('Device not running');

    await this.orchestrator.restartContainer(containerId);
    await this.auditLog(deviceId, ctx.userId, 'restart');
    return mapDevice(data);
  }

  async regenerateAgentToken(ctx: OrgRequestContext, deviceId: string): Promise<string> {
    if (!this.managesDevices(ctx.role)) {
      throw new ForbiddenException('Only administrators can rotate agent tokens');
    }
    await this.assertDeviceAccess(ctx, deviceId);

    const token = this.generateAgentToken();
    const { error } = await this.getClient()
      .from('devices')
      .update({ agent_token: token })
      .eq('id', deviceId)
      .eq('organization_id', ctx.organizationId);
    if (error) throw new Error(error.message);
    return token;
  }

  async getDeviceWithToken(ctx: OrgRequestContext, id: string): Promise<(Device & { agentToken?: string }) | null> {
    if (!this.managesDevices(ctx.role)) {
      throw new ForbiddenException('Only administrators can view agent install credentials');
    }
    const { data, error } = await this.getClient()
      .from('devices')
      .select('*')
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;
    await this.assertDeviceAccess(ctx, id);
    const device = mapDevice(data);
    return { ...device, agentToken: data.agent_token as string };
  }

  async updateDevice(
    ctx: OrgRequestContext,
    id: string,
    updates: Partial<{
      name: string;
      groupId: string | null;
      status: Device['status'];
      batteryLevel: number | null;
      metadata: Record<string, unknown>;
    }>,
  ): Promise<Device> {
    if (!this.managesDevices(ctx.role)) {
      throw new ForbiddenException('Only administrators can update devices');
    }
    await this.assertDeviceAccess(ctx, id);

    if (updates.groupId) {
      await this.assertGroupInOrg(ctx, updates.groupId);
    }

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
        .eq('organization_id', ctx.organizationId)
        .single();
      const merged = { ...(current?.metadata as object ?? {}), ...updates.metadata };
      payload.metadata = merged;
    }

    const { data, error } = await this.getClient()
      .from('devices')
      .update(payload)
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapDevice(data);
  }

  async deleteDevice(ctx: OrgRequestContext, id: string): Promise<void> {
    if (!this.managesDevices(ctx.role)) {
      throw new ForbiddenException('Only administrators can delete devices');
    }
    await this.assertDeviceAccess(ctx, id);

    const { data } = await this.getClient()
      .from('devices')
      .select('container_id')
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .single();

    if (data?.container_id) {
      try {
        await this.orchestrator.stopContainer(data.container_id as string);
      } catch {
        // ignore
      }
    }

    await this.auditLog(id, ctx.userId, 'delete');
    const { error } = await this.getClient()
      .from('devices')
      .delete()
      .eq('id', id)
      .eq('organization_id', ctx.organizationId);

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
  async listGroups(ctx: OrgRequestContext): Promise<DeviceGroup[]> {
    const { data, error } = await this.getClient()
      .from('device_groups')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .order('updated_at', { ascending: false });

    if (error) throw new Error(error.message);

    const groups = (data ?? []).map(mapGroup);
    const ids = await this.accessibleDeviceIds(ctx);

    for (const g of groups) {
      let q = this.getClient()
        .from('devices')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', g.id);

      if (ids !== null) {
        if (ids.length === 0) {
          (g as DeviceGroup & { deviceCount?: number }).deviceCount = 0;
          continue;
        }
        q = q.in('id', ids);
      }
      const { count } = await q;
      (g as DeviceGroup & { deviceCount?: number }).deviceCount = count ?? 0;
    }
    return groups;
  }

  async createGroup(ctx: OrgRequestContext, name: string): Promise<DeviceGroup> {
    if (!this.managesDevices(ctx.role)) {
      throw new ForbiddenException('Only administrators can manage groups');
    }

    const { data, error } = await this.getClient()
      .from('device_groups')
      .insert({ user_id: ctx.userId, organization_id: ctx.organizationId, name })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapGroup(data);
  }

  async updateGroup(ctx: OrgRequestContext, id: string, name: string): Promise<DeviceGroup> {
    if (!this.managesDevices(ctx.role)) {
      throw new ForbiddenException('Only administrators can manage groups');
    }
    await this.assertGroupInOrg(ctx, id);

    const { data, error } = await this.getClient()
      .from('device_groups')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapGroup(data);
  }

  async deleteGroup(ctx: OrgRequestContext, id: string): Promise<void> {
    if (!this.managesDevices(ctx.role)) {
      throw new ForbiddenException('Only administrators can manage groups');
    }
    await this.assertGroupInOrg(ctx, id);

    await this.getClient()
      .from('devices')
      .update({ group_id: null })
      .eq('group_id', id);

    const { error } = await this.getClient()
      .from('device_groups')
      .delete()
      .eq('id', id)
      .eq('organization_id', ctx.organizationId);

    if (error) throw new Error(error.message);
  }

  // --- Commands ---
  async listCommands(ctx: OrgRequestContext, limit = 50): Promise<DeviceCommand[]> {
    const { data, error } = await this.getClient()
      .from('device_commands')
      .select('*')
      .eq('user_id', ctx.userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return (data ?? []).map(mapCommand);
  }

  async createCommand(
    ctx: OrgRequestContext,
    body: {
      commandType: CommandType;
      payload?: Record<string, unknown>;
      targetType: 'device' | 'group';
      targetIds: string[];
    },
  ): Promise<DeviceCommand> {
    if (body.targetType === 'group' && !this.managesDevices(ctx.role)) {
      throw new ForbiddenException('Members cannot run group-wide commands');
    }

    if (body.targetType === 'group') {
      for (const gid of body.targetIds) {
        await this.assertGroupInOrg(ctx, gid);
      }
    } else {
      for (const did of body.targetIds) {
        await this.assertDeviceAccess(ctx, did);
      }
    }

    const { data, error } = await this.getClient()
      .from('device_commands')
      .insert({
        user_id: ctx.userId,
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
  async listAlerts(ctx: OrgRequestContext, unresolvedOnly = true): Promise<DeviceAlert[]> {
    const ids = await this.accessibleDeviceIds(ctx);
    let deviceIds: string[];

    if (ids === null) {
      const { data: devs } = await this.getClient()
        .from('devices')
        .select('id')
        .eq('organization_id', ctx.organizationId);
      deviceIds = (devs ?? []).map((d) => d.id as string);
    } else {
      deviceIds = ids;
    }

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

  async resolveAlert(ctx: OrgRequestContext, alertId: string): Promise<void> {
    const ids = await this.accessibleDeviceIds(ctx);
    let deviceIds: string[];

    if (ids === null) {
      const { data: devs } = await this.getClient()
        .from('devices')
        .select('id')
        .eq('organization_id', ctx.organizationId);
      deviceIds = (devs ?? []).map((d) => d.id as string);
    } else {
      deviceIds = ids;
    }

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
