/** Domain-neutral entities and evidence groups. */
export type EntityId = string;

export interface Entity {
  id: EntityId;
  label: string;
  aliases?: string[];
  /** Optional adapter-provided ranking signal for search result ordering. */
  searchRank?: number;
  metadata?: Record<string, unknown>;
}

export interface MembershipGroup {
  id: string;
  label: string;
  period: string;
  memberIds: EntityId[];
  metadata?: Record<string, unknown>;
}

export interface ConnectionEvidence {
  groupId: string;
  label: string;
  period: string;
  metadata?: Record<string, unknown>;
}
