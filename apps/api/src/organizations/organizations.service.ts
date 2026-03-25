import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import type { OrgRequestContext, OrgRole, OrganizationSummary } from './organizations.types';

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'team';
}

@Injectable()
export class OrganizationsService {
  constructor(private readonly supabase: SupabaseService) {}

  private getClient() {
    return this.supabase.getClient();
  }

  async resolveOrgContext(userId: string, orgIdHeader: string | undefined): Promise<OrgRequestContext> {
    const { data: memberships, error } = await this.getClient()
      .from('organization_members')
      .select(
        'organization_id, role, organizations!inner(id, is_personal, created_at)',
      )
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
    if (!memberships?.length) throw new NotFoundException('No organization');

    const mRows = memberships as unknown as Array<{
      organization_id: string;
      role: string;
      organizations: { id: string; is_personal: boolean; created_at: string };
    }>;

    let orgId = orgIdHeader?.trim() ?? '';
    if (!orgId) {
      const personal = mRows.find((m) => m.organizations?.is_personal === true);
      const first = mRows[0];
      if (!first) throw new NotFoundException('No organization');
      orgId = (personal?.organization_id ?? first.organization_id) as string;
    } else {
      const ok = mRows.some((m) => m.organization_id === orgId);
      if (!ok) throw new ForbiddenException('Not a member of this organization');
    }

    const row = mRows.find((m) => m.organization_id === orgId)!;

    const { data: ownerRow, error: ownerErr } = await this.getClient()
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', orgId)
      .eq('role', 'owner')
      .single();

    if (ownerErr || !ownerRow) throw new BadRequestException('Organization has no owner');

    return {
      userId,
      organizationId: orgId,
      role: row.role as OrgRole,
      ownerUserId: ownerRow.user_id as string,
    };
  }

  async listOrganizationsForUser(userId: string): Promise<OrganizationSummary[]> {
    const { data, error } = await this.getClient()
      .from('organization_members')
      .select(
        `role, organizations ( id, name, slug, is_personal, created_at )`,
      )
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
    const raw = (data ?? []) as unknown as Array<{
      role: string;
      organizations: { id: string; name: string; slug: string; is_personal: boolean; created_at: string };
    }>;
    const rows = raw.map((row) => ({
      id: row.organizations.id,
      name: row.organizations.name,
      slug: row.organizations.slug,
      isPersonal: row.organizations.is_personal,
      createdAt: row.organizations.created_at,
      role: row.role as OrgRole,
    }));
    rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return rows;
  }

  async assertMemberRole(
    orgId: string,
    userId: string,
    min: 'member' | 'admin' | 'owner',
  ): Promise<OrgRole> {
    const { data, error } = await this.getClient()
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new ForbiddenException('Not a member');

    const role = data.role as OrgRole;
    const order: OrgRole[] = ['member', 'admin', 'owner'];
    if (order.indexOf(role) < order.indexOf(min)) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return role;
  }

  private assertAdminOrOwner(role: OrgRole) {
    if (role !== 'admin' && role !== 'owner') {
      throw new ForbiddenException('Administrators only');
    }
  }

  async createOrganization(userId: string, name: string): Promise<OrganizationSummary> {
    const slug = `${slugify(name)}-${randomBytes(3).toString('hex')}`;
    const { data: org, error } = await this.getClient()
      .from('organizations')
      .insert({ name: name.trim(), slug, is_personal: false })
      .select('id, name, slug, is_personal, created_at')
      .single();

    if (error) throw new Error(error.message);

    const { error: memErr } = await this.getClient().from('organization_members').insert({
      organization_id: org.id,
      user_id: userId,
      role: 'owner',
    });

    if (memErr) throw new Error(memErr.message);

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      isPersonal: org.is_personal,
      createdAt: org.created_at,
      role: 'owner',
    };
  }

  async updateOrganization(userId: string, orgId: string, name: string): Promise<void> {
    const role = await this.assertMemberRole(orgId, userId, 'admin');
    this.assertAdminOrOwner(role);

    const { error } = await this.getClient()
      .from('organizations')
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq('id', orgId);

    if (error) throw new Error(error.message);
  }

  async listMembers(userId: string, orgId: string) {
    await this.assertMemberRole(orgId, userId, 'member');

    const { data, error } = await this.getClient()
      .from('organization_members')
      .select('user_id, role, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);

    const members = data ?? [];
    const userIds = members.map((m: { user_id: string }) => m.user_id);
    const profileMap = new Map<
      string,
      { display_name: string | null; avatar_url: string | null }
    >();

    if (userIds.length) {
      const { data: profiles } = await this.getClient()
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);
      for (const p of profiles ?? []) {
        profileMap.set(p.id as string, {
          display_name: p.display_name as string | null,
          avatar_url: p.avatar_url as string | null,
        });
      }
    }

    return members.map((row: { user_id: string; role: string; created_at: string }) => {
      const pr = profileMap.get(row.user_id);
      return {
        userId: row.user_id,
        role: row.role,
        createdAt: row.created_at,
        displayName: pr?.display_name ?? null,
        avatarUrl: pr?.avatar_url ?? null,
      };
    });
  }

  async updateMemberRole(
    actorUserId: string,
    orgId: string,
    targetUserId: string,
    newRole: OrgRole,
  ): Promise<void> {
    const actorRole = await this.assertMemberRole(orgId, actorUserId, 'admin');

    const { data: target } = await this.getClient()
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (!target) throw new NotFoundException('Member not found');
    const prev = target.role as OrgRole;

    if (prev === 'owner') throw new ForbiddenException('Cannot change the organization owner');

    if (newRole === 'owner') throw new BadRequestException('Cannot assign owner role');

    if ((newRole === 'admin' || prev === 'admin') && actorRole !== 'owner') {
      throw new ForbiddenException('Only the owner can manage administrator roles');
    }

    const { error } = await this.getClient()
      .from('organization_members')
      .update({ role: newRole })
      .eq('organization_id', orgId)
      .eq('user_id', targetUserId);

    if (error) throw new Error(error.message);
  }

  async removeMember(actorUserId: string, orgId: string, targetUserId: string): Promise<void> {
    const actorRole = await this.assertMemberRole(orgId, actorUserId, 'admin');

    const { data: target } = await this.getClient()
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (!target) throw new NotFoundException('Member not found');
    if ((target.role as OrgRole) === 'owner') throw new ForbiddenException('Cannot remove the owner');
    if ((target.role as OrgRole) === 'admin' && actorRole !== 'owner') {
      throw new ForbiddenException('Only the owner can remove an administrator');
    }

    if (targetUserId === actorUserId) {
      // self-remove allowed for non-owner
    }

    await this.getClient()
      .from('organization_member_device_access')
      .delete()
      .eq('organization_id', orgId)
      .eq('user_id', targetUserId);

    const { error } = await this.getClient()
      .from('organization_members')
      .delete()
      .eq('organization_id', orgId)
      .eq('user_id', targetUserId);

    if (error) throw new Error(error.message);
  }

  async listInvitations(userId: string, orgId: string) {
    const role = await this.assertMemberRole(orgId, userId, 'admin');
    this.assertAdminOrOwner(role);

    const { data, error } = await this.getClient()
      .from('organization_invitations')
      .select('id, email, role, device_ids, expires_at, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []).map((row: {
      id: string;
      email: string;
      role: string;
      device_ids: string[];
      expires_at: string;
      created_at: string;
    }) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      deviceIds: Array.isArray(row.device_ids) ? row.device_ids : [],
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    }));
  }

  async createInvitation(
    actorUserId: string,
    orgId: string,
    body: { email: string; role: 'admin' | 'member'; deviceIds?: string[] },
  ) {
    const actorRole = await this.assertMemberRole(orgId, actorUserId, 'admin');
    this.assertAdminOrOwner(actorRole);

    if (body.role === 'admin' && actorRole !== 'owner') {
      throw new ForbiddenException('Only the owner can invite administrators');
    }

    const email = body.email.trim().toLowerCase();
    if (!email) throw new BadRequestException('Email required');

    const deviceIds = body.deviceIds ?? [];

    if (deviceIds.length && body.role !== 'member') {
      throw new BadRequestException('Device picks apply to member invitations only');
    }

    if (deviceIds.length) {
      const { count } = await this.getClient()
        .from('devices')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .in('id', deviceIds);
      if ((count ?? 0) !== deviceIds.length) throw new BadRequestException('Invalid device selection');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await this.getClient()
      .from('organization_invitations')
      .insert({
        organization_id: orgId,
        email,
        role: body.role,
        token,
        device_ids: deviceIds,
        invited_by: actorUserId,
        expires_at: expiresAt,
      })
      .select('id, email, role, device_ids, expires_at, created_at')
      .single();

    if (error) throw new Error(error.message);

    return {
      id: data.id,
      email: data.email,
      role: data.role,
      deviceIds: (data.device_ids as string[]) ?? [],
      token,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
    };
  }

  async deleteInvitation(actorUserId: string, orgId: string, invitationId: string): Promise<void> {
    const role = await this.assertMemberRole(orgId, actorUserId, 'admin');
    this.assertAdminOrOwner(role);

    const { error } = await this.getClient()
      .from('organization_invitations')
      .delete()
      .eq('id', invitationId)
      .eq('organization_id', orgId);

    if (error) throw new Error(error.message);
  }

  async acceptInvitation(userId: string, userEmail: string | undefined, token: string): Promise<{ organizationId: string }> {
    const { data: invite, error } = await this.getClient()
      .from('organization_invitations')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!invite) throw new NotFoundException('Invitation not found');

    if (new Date(invite.expires_at as string) < new Date()) {
      throw new BadRequestException('Invitation expired');
    }

    const invitedEmail = String(invite.email).trim().toLowerCase();
    const actualEmail = (userEmail ?? '').trim().toLowerCase();
    if (!actualEmail || invitedEmail !== actualEmail) {
      throw new ForbiddenException('Sign in with the invited email address to accept.');
    }

    const orgId = invite.organization_id as string;
    const role = invite.role as 'admin' | 'member';

    const { data: existing } = await this.getClient()
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) throw new BadRequestException('Already a member');

    const { error: insErr } = await this.getClient().from('organization_members').insert({
      organization_id: orgId,
      user_id: userId,
      role,
    });

    if (insErr) throw new Error(insErr.message);

    const deviceIds = (invite.device_ids as string[]) ?? [];
    if (role === 'member' && deviceIds.length > 0) {
      const rows = deviceIds.map((deviceId) => ({
        organization_id: orgId,
        user_id: userId,
        device_id: deviceId,
      }));
      const { error: gErr } = await this.getClient().from('organization_member_device_access').insert(rows);
      if (gErr) throw new Error(gErr.message);
    }

    await this.getClient().from('organization_invitations').delete().eq('id', invite.id);

    return { organizationId: orgId };
  }

  async getMemberDeviceAccess(userId: string, orgId: string, memberUserId: string): Promise<string[]> {
    const role = await this.assertMemberRole(orgId, userId, 'admin');
    this.assertAdminOrOwner(role);

    const { data: mem } = await this.getClient()
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', memberUserId)
      .maybeSingle();

    if (!mem) throw new NotFoundException('Member not found');
    if ((mem.role as OrgRole) !== 'member') return [];

    const { data, error } = await this.getClient()
      .from('organization_member_device_access')
      .select('device_id')
      .eq('organization_id', orgId)
      .eq('user_id', memberUserId);

    if (error) throw new Error(error.message);
    return (data ?? []).map((r: { device_id: string }) => r.device_id);
  }

  async setMemberDeviceAccess(
    actorUserId: string,
    orgId: string,
    memberUserId: string,
    deviceIds: string[],
  ): Promise<void> {
    const role = await this.assertMemberRole(orgId, actorUserId, 'admin');
    this.assertAdminOrOwner(role);

    const { data: mem } = await this.getClient()
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', memberUserId)
      .maybeSingle();

    if (!mem) throw new NotFoundException('Member not found');
    if ((mem.role as OrgRole) !== 'member') {
      throw new BadRequestException('Device access is managed only for members');
    }

    const uniqueIds = [...new Set(deviceIds)];
    if (uniqueIds.length) {
      const { count } = await this.getClient()
        .from('devices')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .in('id', uniqueIds);
      if ((count ?? 0) !== uniqueIds.length) throw new BadRequestException('Invalid device selection');
    }

    await this.getClient()
      .from('organization_member_device_access')
      .delete()
      .eq('organization_id', orgId)
      .eq('user_id', memberUserId);

    if (uniqueIds.length) {
      const rows = uniqueIds.map((deviceId) => ({
        organization_id: orgId,
        user_id: memberUserId,
        device_id: deviceId,
      }));
      const { error } = await this.getClient()
        .from('organization_member_device_access')
        .insert(rows);
      if (error) throw new Error(error.message);
    }
  }

}
