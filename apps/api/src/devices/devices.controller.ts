import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import type { CommandType } from '@aliremote/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { DevicesService } from './devices.service';

@Controller('devices')
@UseGuards(SupabaseAuthGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  async list(@CurrentUser() user: User) {
    return this.devicesService.listDevices(user.id);
  }

  @Get('groups')
  async listGroups(@CurrentUser() user: User) {
    return this.devicesService.listGroups(user.id);
  }

  @Get('commands')
  async listCommands(@CurrentUser() user: User, @Query('limit') limit?: string) {
    return this.devicesService.listCommands(user.id, limit ? parseInt(limit, 10) : 50);
  }

  @Get('alerts')
  async listAlerts(
    @CurrentUser() user: User,
    @Query('all') all?: string,
  ) {
    return this.devicesService.listAlerts(user.id, all !== 'true');
  }

  @Get(':id')
  async get(@CurrentUser() user: User, @Param('id') id: string, @Query('token') withToken?: string) {
    const device = withToken === 'true'
      ? await this.devicesService.getDeviceWithToken(user.id, id)
      : await this.devicesService.getDevice(user.id, id);
    if (!device) throw new Error('Device not found');
    return device;
  }

  @Post(':id/regenerate-token')
  async regenerateToken(@CurrentUser() user: User, @Param('id') id: string) {
    return { token: await this.devicesService.regenerateAgentToken(user.id, id) };
  }

  @Post(':id/start')
  async start(@CurrentUser() user: User, @Param('id') id: string) {
    return this.devicesService.startDevice(user.id, id);
  }

  @Post(':id/stop')
  async stop(@CurrentUser() user: User, @Param('id') id: string) {
    return this.devicesService.stopDevice(user.id, id);
  }

  @Post(':id/restart')
  async restart(@CurrentUser() user: User, @Param('id') id: string) {
    return this.devicesService.restartDevice(user.id, id);
  }

  @Post()
  async create(
    @CurrentUser() user: User,
    @Body()
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
    },
  ) {
    return this.devicesService.createDevice(user.id, body);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      groupId: string | null;
      status: 'online' | 'offline' | 'busy' | 'error';
      batteryLevel: number | null;
      metadata: Record<string, unknown>;
    }>,
  ) {
    return this.devicesService.updateDevice(user.id, id, body);
  }

  @Delete(':id')
  async delete(@CurrentUser() user: User, @Param('id') id: string) {
    await this.devicesService.deleteDevice(user.id, id);
    return { ok: true };
  }

  @Post('groups')
  async createGroup(@CurrentUser() user: User, @Body() body: { name: string }) {
    return this.devicesService.createGroup(user.id, body.name);
  }

  @Patch('groups/:id')
  async updateGroup(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: { name: string },
  ) {
    return this.devicesService.updateGroup(user.id, id, body.name);
  }

  @Delete('groups/:id')
  async deleteGroup(@CurrentUser() user: User, @Param('id') id: string) {
    await this.devicesService.deleteGroup(user.id, id);
    return { ok: true };
  }

  @Post('commands')
  async createCommand(
    @CurrentUser() user: User,
    @Body()
    body: {
      commandType: CommandType;
      payload?: Record<string, unknown>;
      targetType: 'device' | 'group';
      targetIds: string[];
    },
  ) {
    return this.devicesService.createCommand(user.id, body);
  }

  @Post('alerts/:id/resolve')
  async resolveAlert(@CurrentUser() user: User, @Param('id') alertId: string) {
    await this.devicesService.resolveAlert(user.id, alertId);
    return { ok: true };
  }
}
