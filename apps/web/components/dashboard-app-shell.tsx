'use client';

import { OrgProvider, useOrg } from '@/lib/org-context';
import Link from 'next/link';

function OrgSwitcher() {
  const { orgs, currentOrg, setCurrentOrgId, loading } = useOrg();

  if (loading && orgs.length === 0) {
    return (
      <span className="h-8 w-40 animate-pulse rounded-lg bg-slate-200" aria-hidden />
    );
  }

  if (orgs.length === 0) return null;

  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
        Organization
      </span>
      <select
        value={currentOrg?.id ?? ''}
        onChange={(e) => setCurrentOrgId(e.target.value)}
        className="max-w-[220px] rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-2 pr-8 text-sm font-medium text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function NavInner({ displayName }: { displayName: string }) {
  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
        <div className="flex min-w-0 flex-1 items-center gap-6">
          <Link
            href="/dashboard"
            className="shrink-0 font-display text-xl font-bold tracking-tight text-slate-900"
          >
            Droidstack
          </Link>
          <nav className="hidden items-center gap-5 sm:flex">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/devices"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              Devices
            </Link>
            <Link
              href="/dashboard/team"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              Team
            </Link>
            <Link
              href="/dashboard/billing"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              Billing
            </Link>
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <OrgSwitcher />
          <span className="hidden text-sm text-slate-600 md:inline">{displayName}</span>
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}

export function DashboardAppShell({
  children,
  displayName,
}: {
  children: React.ReactNode;
  displayName: string;
}) {
  return (
    <OrgProvider>
      <NavInner displayName={displayName} />
      {children}
    </OrgProvider>
  );
}
