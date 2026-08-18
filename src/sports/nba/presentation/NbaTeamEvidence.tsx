"use client";

import { useState } from "react";
import type { ConnectionEvidence } from "../../../core/model.ts";
import { collapseNbaTeamEvidence, compactSeasonRanges, type NbaTeamEvidenceGroup } from "./teamEvidence.ts";
import styles from "./nba-presentation.module.css";

export function NbaTeamLogo({ team, className = "" }: { team: NbaTeamEvidenceGroup; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`${styles.teamLogo} ${className}`} aria-hidden="true">
      {team.logoUrl && !failed ? (
        <img src={team.logoUrl} alt="" onError={() => setFailed(true)} />
      ) : (
        <span className={styles.teamLogoFallback}>{team.teamAbbrev}</span>
      )}
    </span>
  );
}

export function NbaTeamEvidence({
  evidence,
  className = "",
}: {
  evidence: readonly ConnectionEvidence[];
  className?: string;
}) {
  const teams = collapseNbaTeamEvidence(evidence);
  return (
    <div className={`${styles.teamEvidenceRow} ${className}`}>
      {teams.map((team) => (
        <details className={styles.teamEvidenceItem} key={team.key}>
          <summary aria-label={team.description} title={team.description}>
            <NbaTeamLogo team={team} />
          </summary>
          <div className={styles.teamEvidencePopover} role="status">
            <strong>{team.label}</strong>
            <span>{compactSeasonRanges(team.seasons).join(" · ")}</span>
          </div>
        </details>
      ))}
    </div>
  );
}
