export type OrgRole = 'owner' | 'admin' | 'member';

export interface OrgRequestContext {
  userId: string;
  organizationId: string;
  role: OrgRole;
  /** User id whose subscription applies to this org (the single owner). */
  ownerUserId: string;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  isPersonal: boolean;
  createdAt: string;
  role: OrgRole;
}
