import type { CSSProperties } from "react";
import type { ChainPresentationProps } from "../../presentation/types.ts";
import { MovieEvidence } from "./MovieEvidence.tsx";
import { MoviePersonPortrait } from "./MoviePersonPortrait.tsx";
import styles from "./movie-presentation.module.css";

const point = (progress: number) => ({ x: 8 + progress * 84, y: 58 - Math.sin(progress * Math.PI) * 38 });
const position = (progress: number): CSSProperties => { const p = point(progress); return { "--route-x": `${p.x}%`, "--route-y": `${p.y}%` } as CSSProperties; };

export function MovieChainView({ chain, links, target, targetReached = false, latestAcceptedLinkIndex, celebrateCompletion = false, connectionAnimationLabel = (from, to) => `Film frame from ${from} to ${to}`, completionLabel = "That’s a wrap!", finishLabel = "CUT!", onRemoveFromIndex, removePlayerLabel, className = "" }: ChainPresentationProps) {
  const reached = targetReached || Boolean(target && chain.at(-1)?.id === target.id);
  const nodes = target && !reached ? [...chain, target] : [...chain];
  const step = nodes.length > 1 ? 1 / (nodes.length - 1) : 0;
  const latest = latestAcceptedLinkIndex === undefined ? undefined : links[latestAcceptedLinkIndex];
  return <section className={`${styles.chainView} ${reached ? styles.completed : ""} ${className}`} aria-label="Film credit connection path">
    <div className={styles.approach}><div className={styles.track} aria-hidden="true" /><div className={styles.ring} role="list">
      {nodes.map((entity, index) => { const pending = !reached && index === nodes.length - 1 && index >= chain.length; const isTarget = Boolean(target && entity.id === target.id) || (reached && index === nodes.length - 1); return <div className={`${styles.personNode} ${isTarget ? styles.target : ""} ${pending ? styles.pending : ""} ${!pending && !reached && index === chain.length - 1 ? styles.current : ""}`} style={position(step * index)} role="listitem" key={`${entity.id}-${index}`}><div className={styles.portraitWrap}><MoviePersonPortrait entity={entity} />{!pending && index > 0 && onRemoveFromIndex ? <button className={styles.removePerson} type="button" onClick={() => onRemoveFromIndex(index)} aria-label={removePlayerLabel?.(entity.label) ?? `Remove ${entity.label} and later people`}>×</button> : null}</div><span className={styles.personName}>{entity.label}</span></div>; })}
      {links.map((link, index) => <div className={styles.evidence} style={position(step * (index + .5))} key={`${link.from.id}-${link.to.id}-${index}`}><MovieEvidence evidence={link.evidence} /></div>)}
      {latest && latestAcceptedLinkIndex !== undefined ? <span className={styles.filmMarker} style={position(step * (latestAcceptedLinkIndex + .5))} role="img" aria-label={connectionAnimationLabel(latest.from.label, latest.to.label)} /> : null}
    </div>{reached && celebrateCompletion ? <div className={styles.completion} aria-live="polite">{completionLabel}</div> : null}{reached ? <div className={styles.wrap} aria-label={finishLabel}>▰ {finishLabel}</div> : null}</div>
  </section>;
}
