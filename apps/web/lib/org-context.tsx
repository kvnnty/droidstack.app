'use client';

import { createClient } from '@/lib/supabase/client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { setStoredOrganizationId, ORG_STORAGE_KEY } from './org-storage';
import type { OrgRole, OrganizationSummary } from './types';

export type { OrgRole, OrganizationSummary };

type OrgContextValue = {
  orgs: OrganizationSummary[];
  currentOrg: OrganizationSummary | null;
  setCurrentOrgId: (id: string) => void;
  refreshOrgs: () => Promise<void>;
  loading: boolean;
};

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [orgs, setOrgs] = useState<OrganizationSummary[]>([]);
  const [currentOrgId, setCurrentOrgIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshOrgs = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setOrgs([]);
      setCurrentOrgIdState(null);
      setLoading(false);
      return;
    }

    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const res = await fetch(`${API_URL}/organizations`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (!res.ok) {
      setLoading(false);
      return;
    }

    const list = (await res.json()) as OrganizationSummary[];
    setOrgs(list);

    const stored =
      typeof window !== 'undefined' ? localStorage.getItem(ORG_STORAGE_KEY) : null;
    const valid = stored && list.some((o) => o.id === stored);
    const nextId = valid ? stored! : list[0]?.id ?? null;

    if (nextId) {
      setStoredOrganizationId(nextId);
      setCurrentOrgIdState(nextId);
    } else {
      setCurrentOrgIdState(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refreshOrgs();
  }, [refreshOrgs]);

  const setCurrentOrgId = useCallback((id: string) => {
    setStoredOrganizationId(id);
    setCurrentOrgIdState(id);
  }, []);

  const currentOrg = orgs.find((o) => o.id === currentOrgId) ?? null;

  return (
    <OrgContext.Provider
      value={{ orgs, currentOrg, setCurrentOrgId, refreshOrgs, loading }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg(): OrgContextValue {
  const v = useContext(OrgContext);
  if (!v) throw new Error('useOrg must be used within OrgProvider');
  return v;
}

export function canManageTeam(role: OrgRole | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function canManageDevices(role: OrgRole | undefined): boolean {
  return role === 'owner' || role === 'admin';
}
