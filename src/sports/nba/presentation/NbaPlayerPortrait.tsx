"use client";

import { useState } from "react";
import type { PortraitProps } from "../../../presentation/types.ts";
import styles from "./nba-presentation.module.css";

const nbaHeadshotUrl = (entity: PortraitProps["entity"]): string | null => {
  const personId = entity.metadata?.personId;
  if (typeof personId !== "string" && typeof personId !== "number") return null;
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${encodeURIComponent(String(personId))}.png`;
};

const initials = (label: string): string => label
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase() ?? "")
  .join("");

export function NbaPlayerPortrait({ entity, size = "large", className = "" }: PortraitProps) {
  const [failed, setFailed] = useState(false);
  const imageUrl = nbaHeadshotUrl(entity);
  const showImage = Boolean(imageUrl && !failed);
  return (
    <span className={`${styles.portrait} ${styles[size]} ${className}`}>
      {showImage ? (
        <img
          src={imageUrl ?? undefined}
          alt={`${entity.label} headshot`}
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{initials(entity.label)}</span>
      )}
    </span>
  );
}
