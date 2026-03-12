import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AgentService {
  constructor(private readonly supabase: SupabaseService) {}

  private getClient() {
    return this.supabase.getClient();
  }

  async validateDevice(deviceId: string, token: string): Promise<{ userId: string } | null> {
    const { data, error } = await this.getClient()
      .from('devices')
      .select('user_id, agent_token')
      .eq('id', deviceId)
      .maybeSingle();

    if (error || !data || data.agent_token !== token) return null;
    return { userId: data.user_id };
  }

  async heartbeat(
    deviceId: string,
    token: string,
    data: { batteryLevel?: number; metadata?: Record<string, unknown> },
  ): Promise<void> {
    const valid = await this.validateDevice(deviceId, token);
    if (!valid) throw new Error('Invalid device or token');

    const payload: Record<string, unknown> = {
      last_seen_at: new Date().toISOString(),
      status: 'online',
      updated_at: new Date().toISOString(),
    };
    if (data.batteryLevel != null) payload.battery_level = data.batteryLevel;
    if (data.metadata) payload.metadata = data.metadata;

    await this.getClient()
      .from('devices')
      .update(payload)
      .eq('id', deviceId);
  }

  async getPendingCommands(deviceId: string, token: string): Promise<{ commands: Array<{ id: string; commandType: string; payload?: Record<string, unknown> }> }> {
    const valid = await this.validateDevice(deviceId, token);
    if (!valid) throw new Error('Invalid device or token');

    const { data: allCommands } = await this.getClient()
      .from('device_commands')
      .select('id, command_type, payload, target_ids')
      .eq('status', 'pending')
      .limit(50);

    const commands = (allCommands ?? []).filter(
      (c) => (c.target_ids as string[])?.includes(deviceId)
    );

    return {
      commands: commands.slice(0, 10).map((c) => ({
        id: c.id,
        commandType: c.command_type,
        payload: c.payload as Record<string, unknown>,
      })),
    };
  }

  async createAlert(
    deviceId: string,
    token: string,
    body: { alertType: string; message?: string; severity?: string },
  ): Promise<{ id: string }> {
    const valid = await this.validateDevice(deviceId, token);
    if (!valid) throw new Error('Invalid device or token');

    const { data, error } = await this.getClient()
      .from('device_alerts')
      .insert({
        device_id: deviceId,
        alert_type: body.alertType,
        message: body.message,
        severity: body.severity ?? 'info',
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);
    return { id: data.id };
  }

  async completeCommand(
    commandId: string,
    token: string,
    body: { success: boolean; result?: Record<string, unknown> },
  ): Promise<void> {
    const { data: cmd } = await this.getClient()
      .from('device_commands')
      .select('id, target_ids')
      .eq('id', commandId)
      .maybeSingle();

    if (!cmd) throw new Error('Command not found');

    const deviceId = (cmd.target_ids as string[])?.[0];
    if (!deviceId) throw new Error('Invalid command');

    const valid = await this.validateDevice(deviceId, token);
    if (!valid) throw new Error('Invalid device or token');

    await this.getClient()
      .from('device_commands')
      .update({
        status: body.success ? 'completed' : 'failed',
        result: body.result ?? {},
        completed_at: new Date().toISOString(),
      })
      .eq('id', commandId);
  }
}
