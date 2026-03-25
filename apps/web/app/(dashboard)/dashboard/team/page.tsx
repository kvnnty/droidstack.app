'use client';

import { api } from '@/lib/api';
import {
  canManageDevices,
  canManageTeam,
  useOrg,
} from '@/lib/org-context';
import type { Device } from '@/lib/types';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  admin: 'Administrator',
  member: 'Member',
};

export default function TeamPage() {
  const { currentOrg, refreshOrgs } = useOrg();
  const [devices, setDevices] = useState<Device[]>([]);
  const [members, setMembers] = useState<
    {
      userId: string;
      role: string;
      createdAt: string;
      displayName: string | null;
    }[]
  >([]);
  const [invites, setInvites] = useState<
    {
      id: string;
      email: string;
      role: string;
      deviceIds: string[];
      expiresAt: string;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newOrgName, setNewOrgName] = useState('');
  const [renameOrg, setRenameOrg] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [inviteDeviceIds, setInviteDeviceIds] = useState<string[]>([]);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);

  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [memberDeviceDraft, setMemberDeviceDraft] = useState<string[]>([]);

  const orgId = currentOrg?.id;
  const role = currentOrg?.role;
  const manageTeam = canManageTeam(role);
  const manageDevices = canManageDevices(role);

  const load = useCallback(async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const [m, inv, devs] = await Promise.all([
        api.organizations.members(orgId),
        manageTeam ? api.organizations.invitations(orgId) : Promise.resolve([]),
        manageTeam ? api.devices.list() : Promise.resolve([]),
      ]);
      setMembers(m);
      setInvites(inv);
      setDevices(devs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [orgId, manageTeam]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (role !== 'owner') setInviteRole('member');
  }, [role]);

  useEffect(() => {
    if (currentOrg?.name) setRenameOrg(currentOrg.name);
  }, [currentOrg?.name]);

  const toggleInviteDevice = (id: string) => {
    setInviteDeviceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const openDeviceAccess = async (memberUserId: string) => {
    if (!orgId) return;
    setExpandedMember(memberUserId);
    try {
      const ids = await api.organizations.memberDevices(orgId, memberUserId);
      setMemberDeviceDraft(ids);
    } catch {
      setMemberDeviceDraft([]);
    }
  };

  const saveDeviceAccess = async () => {
    if (!orgId || !expandedMember) return;
    try {
      await api.organizations.setMemberDevices(orgId, expandedMember, memberDeviceDraft);
      setExpandedMember(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save access');
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center gap-2 text-slate-600">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          Loading team…
        </div>
      </main>
    );
  }

  if (!currentOrg) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-slate-600">No organization context.</p>
        <Link href="/dashboard" className="mt-2 text-sm text-slate-900 underline">
          Dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Team</p>
          <h1 className="font-display text-3xl font-bold text-slate-900">{currentOrg.name}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Your role:{' '}
            <span className="font-medium text-slate-900">{ROLE_LABEL[currentOrg.role]}</span>
            {currentOrg.isPersonal ? (
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                Personal workspace
              </span>
            ) : null}
          </p>
        </div>
        <Link
          href="/dashboard/devices"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← Devices
        </Link>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {manageTeam && (
        <section className="mt-10 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="font-display text-lg font-semibold text-slate-900">Organization</h2>
          <p className="mt-1 text-sm text-slate-600">
            Rename this team or create an additional organization to collaborate with others.
          </p>
          <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end">
            <form
              className="flex flex-1 flex-wrap items-end gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!renameOrg.trim() || !orgId) return;
                try {
                  await api.organizations.rename(orgId, renameOrg.trim());
                  await refreshOrgs();
                  setError(null);
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Rename failed');
                }
              }}
            >
              <div className="min-w-[200px] flex-1">
                <label className="text-xs font-medium text-slate-500">Display name</label>
                <input
                  value={renameOrg}
                  onChange={(e) => setRenameOrg(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Save name
              </button>
            </form>
            <form
              className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newOrgName.trim()) return;
                try {
                  await api.organizations.create(newOrgName.trim());
                  setNewOrgName('');
                  await refreshOrgs();
                  setError(null);
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Create failed');
                }
              }}
            >
              <div className="min-w-[160px]">
                <label className="text-xs font-medium text-slate-500">New organization</label>
                <input
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="e.g. Acme Mobile"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                Create
              </button>
            </form>
          </div>
        </section>
      )}

      <section className="mt-10 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-slate-900">Members</h2>
        <p className="mt-1 text-sm text-slate-600">
          Owners have full control. Administrators manage people, invitations, and devices. Members only
          see devices you assign.
        </p>
        <ul className="mt-6 divide-y divide-slate-100">
          {members.map((m) => {
            const ownerId = members.find((x) => x.role === 'owner')?.userId;
            return (
              <li key={m.userId} className="py-5 first:pt-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-slate-900">
                      {m.displayName ?? 'User'}{' '}
                      <span className="text-slate-400">·</span>{' '}
                      <span className="text-sm font-normal text-slate-500">{m.userId.slice(0, 8)}…</span>
                    </p>
                    <p className="text-xs text-slate-500">{ROLE_LABEL[m.role]}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {m.role === 'member' && manageTeam && manageDevices && (
                      <button
                        type="button"
                        onClick={() => void openDeviceAccess(m.userId)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Device access
                      </button>
                    )}
                    {manageTeam && m.userId !== ownerId && m.role !== 'owner' && (
                      <>
                        {role === 'owner' && m.role !== 'owner' && (
                          <select
                            value={m.role}
                            onChange={async (e) => {
                              if (!orgId) return;
                              try {
                                await api.organizations.patchMemberRole(orgId, m.userId, e.target.value);
                                await load();
                              } catch (err) {
                                setError(err instanceof Error ? err.message : 'Update failed');
                              }
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium"
                          >
                            <option value="member">Member</option>
                            <option value="admin">Administrator</option>
                          </select>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            if (!orgId) return;
                            if (!confirm('Remove this member from the organization?')) return;
                            try {
                              await api.organizations.removeMember(orgId, m.userId);
                              await load();
                            } catch (err) {
                              setError(err instanceof Error ? err.message : 'Remove failed');
                            }
                          }}
                          className="text-xs font-medium text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {expandedMember === m.userId && m.role === 'member' && manageTeam && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-medium text-slate-600">Assigned devices</p>
                    <div className="mt-3 max-h-40 space-y-2 overflow-y-auto">
                      {devices.map((d) => (
                        <label key={d.id} className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={memberDeviceDraft.includes(d.id)}
                            onChange={() =>
                              setMemberDeviceDraft((prev) =>
                                prev.includes(d.id) ? prev.filter((x) => x !== d.id) : [...prev, d.id],
                              )
                            }
                            className="rounded border-slate-300"
                          />
                          <span>{d.name}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void saveDeviceAccess()}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedMember(null)}
                        className="text-xs text-slate-600 hover:text-slate-900"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {manageTeam && (
        <section className="mt-10 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="font-display text-lg font-semibold text-slate-900">Invitations</h2>
          <p className="mt-1 text-sm text-slate-600">
            Invite by email. Administrators can only invite members; only owners can invite other
            administrators. The invitee must sign in with that email to accept.
          </p>

          <form
            className="mt-6 grid gap-4 border-t border-slate-100 pt-6 md:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!orgId || !inviteEmail.trim()) return;
              try {
                const effectiveRole = role === 'owner' ? inviteRole : 'member';
                const res = await api.organizations.createInvitation(orgId, {
                  email: inviteEmail.trim(),
                  role: effectiveRole,
                  deviceIds: effectiveRole === 'member' ? inviteDeviceIds : undefined,
                });
                const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${res.token}`;
                setLastInviteLink(link);
                setInviteEmail('');
                setInviteDeviceIds([]);
                await load();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Invite failed');
              }
            }}
          >
            <div>
              <label className="text-xs font-medium text-slate-500">Email</label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="colleague@company.com"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Role</label>
              <select
                value={role === 'owner' ? inviteRole : 'member'}
                onChange={(e) => setInviteRole(e.target.value as 'member' | 'admin')}
                disabled={role !== 'owner'}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-60"
              >
                <option value="member">Member</option>
                {role === 'owner' ? <option value="admin">Administrator</option> : null}
              </select>
            </div>
            {inviteRole === 'member' && devices.length > 0 && (
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-slate-500">Devices (optional)</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {devices.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleInviteDevice(d.id)}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        inviteDeviceIds.includes(d.id)
                          ? 'bg-slate-900 text-white'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {d.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Send invitation
              </button>
            </div>
          </form>

          {lastInviteLink && (
            <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <p className="font-medium">Invite link (share securely)</p>
              <div className="mt-2 flex gap-2">
                <input readOnly value={lastInviteLink} className="flex-1 rounded border border-emerald-200 bg-white px-2 py-1 text-xs" />
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(lastInviteLink)}
                  className="rounded border border-emerald-700 px-2 py-1 text-xs font-medium text-emerald-900"
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          {invites.length > 0 && (
            <ul className="mt-6 divide-y divide-slate-100 border-t border-slate-100 pt-4">
              {invites.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <span className="font-medium text-slate-900">{inv.email}</span>
                    <span className="ml-2 text-slate-500">· {ROLE_LABEL[inv.role]}</span>
                    {inv.deviceIds?.length ? (
                      <span className="ml-2 text-xs text-slate-400">
                        {inv.deviceIds.length} device(s) pre-assigned
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!orgId) return;
                      try {
                        await api.organizations.deleteInvitation(orgId, inv.id);
                        await load();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed');
                      }
                    }}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
