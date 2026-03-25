export const ORG_STORAGE_KEY = 'droidstack_org_id';

export function getStoredOrganizationId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ORG_STORAGE_KEY);
}

export function setStoredOrganizationId(id: string): void {
  localStorage.setItem(ORG_STORAGE_KEY, id);
}
