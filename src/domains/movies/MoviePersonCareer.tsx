import type { ConnectionEvidence, Entity } from "../../core/model.ts";
import styles from "./movie-presentation.module.css";

export function MoviePersonCareer({ entity, evidence = [] }: { entity: Entity; evidence?: readonly ConnectionEvidence[] }) {
  const knownTitles = Array.isArray(entity.metadata?.knownTitles) ? entity.metadata.knownTitles.filter((value): value is string => typeof value === "string") : [];
  const roles = Array.isArray(entity.metadata?.roles) ? entity.metadata.roles.filter((value): value is string => typeof value === "string") : [];
  return <span className={styles.career}><strong>{roles.slice(0, 2).join(" · ") || "Film credits"}</strong><span>{knownTitles.slice(0, 3).join(" · ") || `${evidence.length} credited film${evidence.length === 1 ? "" : "s"}`}</span></span>;
}
