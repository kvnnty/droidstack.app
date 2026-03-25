import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { OrganizationsService } from './organizations.service';
import type { OrgRole } from './organizations.types';

@Controller('organizations')
@UseGuards(SupabaseAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.organizations.listOrganizationsForUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() body: { name: string }) {
    return this.organizations.createOrganization(user.id, body.name);
  }

  @Post('invitations/accept')
  accept(@CurrentUser() user: User, @Body() body: { token: string }) {
    return this.organizations.acceptInvitation(user.id, user.email ?? undefined, body.token);
  }

  @Patch(':orgId')
  async rename(
    @CurrentUser() user: User,
    @Param('orgId') orgId: string,
    @Body() body: { name: string },
  ) {
    await this.organizations.updateOrganization(user.id, orgId, body.name);
    return { ok: true };
  }

  @Get(':orgId/members')
  members(@CurrentUser() user: User, @Param('orgId') orgId: string) {
    return this.organizations.listMembers(user.id, orgId);
  }

  @Patch(':orgId/members/:memberUserId')
  async patchMemberRole(
    @CurrentUser() user: User,
    @Param('orgId') orgId: string,
    @Param('memberUserId') memberUserId: string,
    @Body() body: { role: OrgRole },
  ) {
    await this.organizations.updateMemberRole(user.id, orgId, memberUserId, body.role);
    return { ok: true };
  }

  @Delete(':orgId/members/:memberUserId')
  async removeMember(
    @CurrentUser() user: User,
    @Param('orgId') orgId: string,
    @Param('memberUserId') memberUserId: string,
  ) {
    await this.organizations.removeMember(user.id, orgId, memberUserId);
    return { ok: true };
  }

  @Get(':orgId/invitations')
  listInvites(@CurrentUser() user: User, @Param('orgId') orgId: string) {
    return this.organizations.listInvitations(user.id, orgId);
  }

  @Post(':orgId/invitations')
  createInvite(
    @CurrentUser() user: User,
    @Param('orgId') orgId: string,
    @Body() body: { email: string; role: 'admin' | 'member'; deviceIds?: string[] },
  ) {
    return this.organizations.createInvitation(user.id, orgId, body);
  }

  @Delete(':orgId/invitations/:invitationId')
  async deleteInvite(
    @CurrentUser() user: User,
    @Param('orgId') orgId: string,
    @Param('invitationId') invitationId: string,
  ) {
    await this.organizations.deleteInvitation(user.id, orgId, invitationId);
    return { ok: true };
  }

  @Get(':orgId/members/:memberUserId/devices')
  getMemberDevices(
    @CurrentUser() user: User,
    @Param('orgId') orgId: string,
    @Param('memberUserId') memberUserId: string,
  ) {
    return this.organizations.getMemberDeviceAccess(user.id, orgId, memberUserId);
  }

  @Put(':orgId/members/:memberUserId/devices')
  async putMemberDevices(
    @CurrentUser() user: User,
    @Param('orgId') orgId: string,
    @Param('memberUserId') memberUserId: string,
    @Body() body: { deviceIds: string[] },
  ) {
    await this.organizations.setMemberDeviceAccess(
      user.id,
      orgId,
      memberUserId,
      body.deviceIds ?? [],
    );
    return { ok: true };
  }
}
