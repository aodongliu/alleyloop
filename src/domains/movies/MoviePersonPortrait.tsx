import type { PortraitProps } from "../../presentation/types.ts";
import styles from "./movie-presentation.module.css";

const initials = (label: string): string => label.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");

export function MoviePersonPortrait({ entity, size = "large", className = "" }: PortraitProps) {
  return <span className={`${styles.portrait} ${styles[size]} ${className}`} aria-label={`${entity.label} portrait`}><span aria-hidden="true">{initials(entity.label)}</span></span>;
}
