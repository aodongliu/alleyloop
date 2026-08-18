import type { ConnectionEvidence } from "../../core/model.ts";
import styles from "./movie-presentation.module.css";

const text = (value: unknown): string | undefined => typeof value === "string" && value.trim() ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : undefined;
const title = (item: ConnectionEvidence): string => item.label || text(item.metadata?.titleId) || "Untitled film";
const year = (item: ConnectionEvidence): string => text(item.metadata?.year) ?? item.period;
const details = (item: ConnectionEvidence): string[] => [
  year(item),
  text(item.metadata?.rating) ? `★ ${text(item.metadata?.rating)}` : undefined,
  text(item.metadata?.genres),
].filter((value): value is string => Boolean(value));

export function MovieEvidence({ evidence, className = "" }: { evidence: readonly ConnectionEvidence[]; className?: string }) {
  return <div className={`${styles.evidenceList} ${className}`}>{evidence.map((item) => <details className={styles.ticket} key={item.groupId}><summary className={styles.ticketTitle}>{title(item)}</summary><span className={styles.ticketPeriod}>{details(item).join(" · ")}</span></details>)}</div>;
}

export function MovieClue({ evidence }: { evidence: readonly ConnectionEvidence[] }) {
  const item = evidence[0];
  if (!item) return null;
  return <span className={styles.clue}><span className={styles.clueMark} aria-hidden="true" /><span>{title(item)} · {year(item)}</span></span>;
}
