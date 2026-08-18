import type { ConnectionEvidence } from "../../../core/model.ts";
import { NbaTeamLogo } from "./NbaTeamEvidence.tsx";
import { collapseNbaTeamEvidence, compactSeasonRanges, type NbaTeamEvidenceGroup } from "./teamEvidence.ts";
import styles from "./nba-presentation.module.css";

function CareerSet({ teams, duplicate = false }: { teams: readonly NbaTeamEvidenceGroup[]; duplicate?: boolean }) {
  return (
    <span className={`${styles.careerSet} ${duplicate ? styles.careerDuplicate : ""}`}>
      {teams.map((team) => {
        const seasons = compactSeasonRanges(team.seasons).join(" · ");
        const teamNames = team.labels.join(" / ");
        return (
          <span className={styles.careerTeam} title={`${teamNames}: ${seasons}`} key={team.key}>
            <NbaTeamLogo team={team} className={styles.careerTeamLogo} />
            <span className={styles.careerSeasons}>{seasons}</span>
          </span>
        );
      })}
    </span>
  );
}

export function NbaPlayerCareer({
  playerLabel,
  evidence,
}: {
  playerLabel: string;
  evidence: readonly ConnectionEvidence[];
}) {
  const teams = collapseNbaTeamEvidence(evidence);
  const rangeCount = teams.reduce((total, team) => total + compactSeasonRanges(team.seasons).length, 0);
  const rolling = teams.length > 4 || rangeCount > 6;
  const description = teams
    .map((team) => `${team.labels.join(" / ")}: ${compactSeasonRanges(team.seasons).join(", ")}`)
    .join("; ");

  return (
    <span className={`${styles.careerHistory} ${rolling ? styles.careerRolling : ""}`}>
      <span className={styles.srOnly}>{playerLabel} teams and seasons: {description}</span>
      <span className={styles.careerTrack} aria-hidden="true">
        <CareerSet teams={teams} />
        {rolling ? <CareerSet teams={teams} duplicate /> : null}
      </span>
    </span>
  );
}
