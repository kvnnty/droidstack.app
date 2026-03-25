import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import type { CommandType } from '@droidstack/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { OrganizationsService } from '../organizations/organizations.service';
import { DevicesService } from './devices.service';

@Controller('devices')
@UseGuards(SupabaseAuthGuard)
export class DevicesController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  private async ctx(user: User, orgHeader?: string) {
    return this.organizationsService.resolveOrgContext(user.id, orgHeader);
  }

  @Get()
  async list(@CurrentUser() user: User, @Headers('x-organization-id') orgHeader?: string) {
    return this.devicesService.listDevices(await this.ctx(user, orgHeader));
  }

  @Get('groups')
  async listGroups(@CurrentUser() user: User, @Headers('x-organization-id') orgHeader?: string) {
    return this.devicesService.listGroups(await this.ctx(user, orgHeader));
  }

  @Get('commands')
  async listCommands(
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
    @Headers('x-organization-id') orgHeader?: string,
  ) {
    return this.devicesService.listCommands(
      await this.ctx(user, orgHeader),
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('alerts')
  async listAlerts(
    @CurrentUser() user: User,
    @Query('all') all?: string,
    @Headers('x-organization-id') orgHeader?: string,
  ) {
    return this.devicesService.listAlerts(await this.ctx(user, orgHeader), all !== 'true');
  }

  @Get(':id')
  async get(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('token') withToken?: string,
    @Headers('x-organization-id') orgHeader?: string,
  ) {
    const c = await this.ctx(user, orgHeader);
    const device = withToken === 'true'
      ? await this.devicesService.getDeviceWithToken(c, id)
      : await this.devicesService.getDevice(c, id);
    if (!device) throw new Error('Device not found');
    return device;
  }

  @Post(':id/regenerate-token')
  async regenerateToken(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Headers('x-organization-id') orgHeader?: string,
  ) {
    return { token: await this.devicesService.regenerateAgentToken(await this.ctx(user, orgHeader), id) };
  }

  @Post(':id/start')
  async start(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Headers('x-organization-id') orgHeader?: string,
  ) {
    return this.devicesService.startDevice(await this.ctx(user, orgHeader), id);
  }

  @Post(':id/stop')
  async stop(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Headers('x-organization-id') orgHeader?: string,
  ) {
    return this.devicesService.stopDevice(await this.ctx(user, orgHeader), id);
  }

  @Post(':id/restart')
  async restart(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Headers('x-organization-id') orgHeader?: string,
  ) {
    return this.devicesService.restartDevice(await this.ctx(user, orgHeader), id);
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
    @Headers('x-organization-id') orgHeader?: string,
  ) {
    return this.devicesService.createDevice(await this.ctx(user, orgHeader), body);
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
    @Headers('x-organization-id') orgHeader?: string,
  ) {
    return this.devicesService.updateDevice(await this.ctx(user, orgHeader), id, body);
  }

  @Delete(':id')
  async delete(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Headers('x-organization-id') orgHeader?: string,
  ) {
    await this.devicesService.deleteDevice(await this.ctx(user, orgHeader), id);
    return { ok: true };
  }

  @Post('groups')
  async createGroup(
    @CurrentUser() user: User,
    @Body() body: { name: string },
    @Headers('x-organization-id') orgHeader?: string,
  ) {
    return this.devicesService.createGroup(await this.ctx(user, orgHeader), body.name);
  }

  @Patch('groups/:id')
  async updateGroup(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: { name: string },
    @Headers('x-organization-id') orgHeader?: string,
  ) {
    return this.devicesService.updateGroup(await this.ctx(user, orgHeader), id, body.name);
  }

  @Delete('groups/:id')
  async deleteGroup(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Headers('x-organization-id') orgHeader?: string,
  ) {
    await this.devicesService.deleteGroup(await this.ctx(user, orgHeader), id);
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
    @Headers('x-organization-id') orgHeader?: string,
  ) {
    return this.devicesService.createCommand(await this.ctx(user, orgHeader), body);
  }

  @Post('alerts/:id/resolve')
  async resolveAlert(
    @CurrentUser() user: User,
    @Param('id') alertId: string,
    @Headers('x-organization-id') orgHeader?: string,
  ) {
    await this.devicesService.resolveAlert(await this.ctx(user, orgHeader), alertId);
    return { ok: true };
  }
}
