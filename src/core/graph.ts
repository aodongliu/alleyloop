import type { ConnectionEvidence, Entity, EntityId, MembershipGroup } from "./model.ts";

const fold = (value: string): string => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, "")
  .trim();

export interface SearchResult extends Entity {
  matchedOn: "label" | "alias";
}

export interface ShortestPath {
  ids: EntityId[];
  links: number;
}

export interface ChainLinkValidation {
  fromId: EntityId;
  toId: EntityId;
  valid: boolean;
  evidence: ConnectionEvidence[];
}

export interface ChainValidation {
  valid: boolean;
  links: ChainLinkValidation[];
  invalidLinks: number[];
}

/** An in-memory, unweighted graph built from arbitrary membership groups. */
export class ConnectionGraph {
  private readonly entityById = new Map<EntityId, Entity>();
  private readonly groupById = new Map<string, MembershipGroup>();
  private readonly groupsByMember = new Map<EntityId, MembershipGroup[]>();

  constructor(entities: Iterable<Entity> = [], groups: Iterable<MembershipGroup> = []) {
    for (const entity of entities) this.addEntity(entity);
    for (const group of groups) this.addGroup(group);
  }

  addEntity(entity: Entity): void {
    if (this.entityById.has(entity.id)) throw new Error(`Duplicate entity id: ${entity.id}`);
    this.entityById.set(entity.id, {
      ...entity,
      aliases: entity.aliases ? [...entity.aliases] : undefined,
    });
  }

  addGroup(group: MembershipGroup): void {
    if (this.groupById.has(group.id)) throw new Error(`Duplicate group id: ${group.id}`);
    const memberIds = [...new Set(group.memberIds)];
    for (const id of memberIds) {
      if (!this.entityById.has(id)) throw new Error(`Unknown entity ${id} in group ${group.id}`);
    }
    const stored = { ...group, memberIds };
    this.groupById.set(group.id, stored);
    for (const id of memberIds) {
      this.groupsByMember.set(id, [...(this.groupsByMember.get(id) ?? []), stored]);
    }
  }

  getEntity(id: EntityId): Entity | undefined {
    return this.entityById.get(id);
  }

  entities(): Entity[] {
    return [...this.entityById.values()];
  }

  groups(): MembershipGroup[] {
    return [...this.groupById.values()];
  }

  /** All membership groups supporting an entity, without exposing sport assumptions. */
  membershipEvidence(id: EntityId): ConnectionEvidence[] {
    if (!this.entityById.has(id)) return [];
    return (this.groupsByMember.get(id) ?? [])
      .map(({ id: groupId, label, period, metadata }) => ({ groupId, label, period, metadata }));
  }

  sharedEvidence(a: EntityId, b: EntityId): ConnectionEvidence[] {
    if (!this.entityById.has(a) || !this.entityById.has(b) || a === b) return [];
    const bGroups = new Set((this.groupsByMember.get(b) ?? []).map((group) => group.id));
    return (this.groupsByMember.get(a) ?? [])
      .filter((group) => bGroups.has(group.id))
      .map(({ id: groupId, label, period, metadata }) => ({ groupId, label, period, metadata }));
  }

  areConnected(a: EntityId, b: EntityId): boolean {
    return this.sharedEvidence(a, b).length > 0;
  }

  /** Validate every consecutive link in a proposed chain and retain its evidence. */
  validateChain(ids: readonly EntityId[]): ChainValidation {
    const links: ChainLinkValidation[] = [];
    const invalidLinks: number[] = [];
    for (let index = 0; index < Math.max(0, ids.length - 1); index += 1) {
      const fromId = ids[index];
      const toId = ids[index + 1];
      const evidence = this.sharedEvidence(fromId, toId);
      const valid = evidence.length > 0;
      links.push({ fromId, toId, valid, evidence });
      if (!valid) invalidLinks.push(index);
    }
    const hasKnownEndpoints = ids.length > 0 && ids.every((id) => this.entityById.has(id));
    return { valid: hasKnownEndpoints && invalidLinks.length === 0, links, invalidLinks };
  }

  neighbors(id: EntityId): EntityId[] {
    const result = new Set<EntityId>();
    for (const group of this.groupsByMember.get(id) ?? []) {
      for (const member of group.memberIds) {
        if (member !== id) result.add(member);
      }
    }
    return [...result].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  search(query: string, limit = 10): SearchResult[] {
    const needle = fold(query);
    if (!needle || limit <= 0) return [];
    return this.entities().flatMap((entity): SearchResult[] => {
      const labelMatch = fold(entity.label).includes(needle);
      const aliasMatch = (entity.aliases ?? []).some((alias) => fold(alias).includes(needle));
      return labelMatch || aliasMatch ? [{ ...entity, matchedOn: labelMatch ? "label" : "alias" }] : [];
    }).sort((a, b) => {
      const aLabel = fold(a.label);
      const bLabel = fold(b.label);
      const aExact = aLabel === needle ? 0 : 1;
      const bExact = bLabel === needle ? 0 : 1;
      const aPrefix = aLabel.startsWith(needle) ? 0 : 1;
      const bPrefix = bLabel.startsWith(needle) ? 0 : 1;
      return aExact - bExact
        || aPrefix - bPrefix
        || (b.searchRank ?? 0) - (a.searchRank ?? 0)
        || a.label.localeCompare(b.label);
    }).slice(0, limit);
  }

  shortestPath(
    start: EntityId,
    target: EntityId,
    excludedIds: Iterable<EntityId> = [],
  ): ShortestPath | null {
    if (!this.entityById.has(start) || !this.entityById.has(target)) return null;
    if (start === target) return { ids: [start], links: 0 };
    const excluded = new Set(excludedIds);
    excluded.delete(start);
    excluded.delete(target);
    const queue: EntityId[] = [start];
    const previous = new Map<EntityId, EntityId | null>([[start, null]]);
    let found = false;
    for (let cursor = 0; cursor < queue.length && !found; cursor += 1) {
      const current = queue[cursor];
      for (const next of this.neighbors(current)) {
        if (previous.has(next) || excluded.has(next)) continue;
        previous.set(next, current);
        queue.push(next);
        if (next === target) {
          found = true;
          break;
        }
      }
    }
    if (!previous.has(target)) return null;
    const ids: EntityId[] = [];
    let cursor: EntityId | null = target;
    while (cursor !== null) {
      ids.unshift(cursor);
      cursor = previous.get(cursor) ?? null;
    }
    return { ids, links: ids.length - 1 };
  }
}

export { fold as normalizeSearchText };
