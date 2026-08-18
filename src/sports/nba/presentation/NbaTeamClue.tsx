import type { ConnectionEvidence } from "../../../core/model.ts";
import { NbaTeamLogo } from "./NbaTeamEvidence.tsx";
import { collapseNbaTeamEvidence, compactSeasonRanges } from "./teamEvidence.ts";
import styles from "./nba-presentation.module.css";

export function NbaTeamClue({ evidence }: { evidence: readonly ConnectionEvidence[] }) {
  // Reveal one shared team only so the hint guides without naming or over-specifying the player.
  const team = collapseNbaTeamEvidence(evidence)[0];
  if (!team) return null;
  const seasons = compactSeasonRanges(team.seasons).join(" · ");
  return (
    <span className={styles.teamClue} title={`${team.labels.join(" / ")}: ${seasons}`}>
      <NbaTeamLogo team={team} className={styles.teamClueLogo} />
      <span className={styles.teamClueSeasons}>{seasons}</span>
      <span className={styles.srOnly}>{team.label}</span>
    </span>
  );
}
