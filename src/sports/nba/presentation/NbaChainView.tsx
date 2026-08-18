"use client";

import type { CSSProperties } from "react";
import type { ChainPresentationProps } from "../../../presentation/types.ts";
import { NbaPlayerPortrait } from "./NbaPlayerPortrait.tsx";
import { NbaTeamEvidence } from "./NbaTeamEvidence.tsx";
import styles from "./nba-presentation.module.css";

const courtArtworkUrl = `${import.meta.env.BASE_URL}assets/nba-court-perspective.webp`;

type CourtPoint = Readonly<{ x: number; y: number }>;

/**
 * One cubic half-loop, anchored to the hardwood's far-right corner and the rim.
 * Every player and every connection uses this same curve, so link boundaries
 * stay tangent-continuous instead of creating a chain of visible bends.
 */
const routeCurve = {
  start: { x: 42.5, y: 19.2 },
  firstControl: { x: -19.7415, y: 34.3238 },
  secondControl: { x: 46.2937, y: 114.8444 },
  end: { x: 77, y: 36 },
} as const;

const pointOnCurve = (amount: number): CourtPoint => {
  const remaining = 1 - amount;
  const startWeight = remaining ** 3;
  const firstControlWeight = 3 * remaining ** 2 * amount;
  const secondControlWeight = 3 * remaining * amount ** 2;
  const endWeight = amount ** 3;
  return {
    x: routeCurve.start.x * startWeight
      + routeCurve.firstControl.x * firstControlWeight
      + routeCurve.secondControl.x * secondControlWeight
      + routeCurve.end.x * endWeight,
    y: routeCurve.start.y * startWeight
      + routeCurve.firstControl.y * firstControlWeight
      + routeCurve.secondControl.y * secondControlWeight
      + routeCurve.end.y * endWeight,
  };
};

const curveDerivative = (amount: number): CourtPoint => {
  const remaining = 1 - amount;
  return {
    x: 3 * remaining ** 2 * (routeCurve.firstControl.x - routeCurve.start.x)
      + 6 * remaining * amount * (routeCurve.secondControl.x - routeCurve.firstControl.x)
      + 3 * amount ** 2 * (routeCurve.end.x - routeCurve.secondControl.x),
    y: 3 * remaining ** 2 * (routeCurve.firstControl.y - routeCurve.start.y)
      + 6 * remaining * amount * (routeCurve.secondControl.y - routeCurve.firstControl.y)
      + 3 * amount ** 2 * (routeCurve.end.y - routeCurve.secondControl.y),
  };
};

const routeSampleCount = 240;
const routeSamples = Array.from(
  { length: routeSampleCount + 1 },
  (_, index) => pointOnCurve(index / routeSampleCount),
);
const cumulativeRouteDistances = routeSamples.reduce<number[]>((distances, point, index) => {
  if (index === 0) {
    distances.push(0);
    return distances;
  }
  const previous = routeSamples[index - 1];
  distances.push(
    distances[index - 1] + Math.hypot(point.x - previous.x, (point.y - previous.y) * (9 / 16)),
  );
  return distances;
}, []);
const totalRouteDistance = cumulativeRouteDistances.at(-1) ?? 1;

const routeParameterAtProgress = (progress: number): number => {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  if (clampedProgress === 0 || clampedProgress === 1) return clampedProgress;

  const targetDistance = clampedProgress * totalRouteDistance;
  const upperIndex = Math.max(1, cumulativeRouteDistances.findIndex((distance) => distance >= targetDistance));
  const lowerIndex = upperIndex - 1;
  const segmentDistance = cumulativeRouteDistances[upperIndex] - cumulativeRouteDistances[lowerIndex];
  const segmentProgress = segmentDistance === 0
    ? 0
    : (targetDistance - cumulativeRouteDistances[lowerIndex]) / segmentDistance;
  return (lowerIndex + segmentProgress) / routeSampleCount;
};

const pointOnRoute = (progress: number): CourtPoint => pointOnCurve(routeParameterAtProgress(progress));

const positionStyle = (progress: number): CSSProperties => {
  const point = pointOnRoute(progress);
  return {
    "--route-x": `${point.x}%`,
    "--route-y": `${point.y}%`,
    "--depth-scale": `${0.74 + progress * 0.36}`,
    "--depth-z": `${Math.round(progress * 12)}`,
  } as CSSProperties;
};

const connectionGeometry = (fromProgress: number, toProgress: number) => {
  const fromParameter = routeParameterAtProgress(fromProgress);
  const toParameter = routeParameterAtProgress(toProgress);
  const parameterSpan = toParameter - fromParameter;
  const from = pointOnCurve(fromParameter);
  const to = pointOnCurve(toParameter);
  const fromDerivative = curveDerivative(fromParameter);
  const toDerivative = curveDerivative(toParameter);
  const firstControl = {
    x: from.x + fromDerivative.x * parameterSpan / 3,
    y: from.y + fromDerivative.y * parameterSpan / 3,
  };
  const secondControl = {
    x: to.x - toDerivative.x * parameterSpan / 3,
    y: to.y - toDerivative.y * parameterSpan / 3,
  };
  const midpoint = pointOnRoute((fromProgress + toProgress) / 2);

  return {
    path: `M ${from.x} ${from.y} C ${firstControl.x} ${firstControl.y} ${secondControl.x} ${secondControl.y} ${to.x} ${to.y}`,
    midpoint,
  };
};

const evidenceStyle = (fromProgress: number, toProgress: number, index: number): CSSProperties => {
  const { midpoint } = connectionGeometry(fromProgress, toProgress);
  return {
    "--route-x": `${midpoint.x + (index % 2 ? 1 : -1)}%`,
    "--route-y": `${midpoint.y - 1.3}%`,
    "--depth-scale": `${0.74 + ((fromProgress + toProgress) / 2) * 0.22}`,
    "--depth-z": `${Math.round(((fromProgress + toProgress) / 2) * 12) + 1}`,
  } as CSSProperties;
};

const passStyle = (fromProgress: number, toProgress: number, delayMs: number): CSSProperties => {
  const from = pointOnRoute(fromProgress);
  const to = pointOnRoute(toProgress);
  const progressSpan = toProgress - fromProgress;
  const firstQuarter = pointOnRoute(fromProgress + progressSpan * 0.25);
  const midpoint = pointOnRoute(fromProgress + progressSpan * 0.5);
  const thirdQuarter = pointOnRoute(fromProgress + progressSpan * 0.75);
  return {
    "--pass-from-x": `${from.x}%`,
    "--pass-from-y": `${from.y}%`,
    "--pass-first-quarter-x": `${firstQuarter.x}%`,
    "--pass-first-quarter-y": `${firstQuarter.y}%`,
    "--pass-mid-x": `${midpoint.x}%`,
    "--pass-mid-y": `${midpoint.y}%`,
    "--pass-third-quarter-x": `${thirdQuarter.x}%`,
    "--pass-third-quarter-y": `${thirdQuarter.y}%`,
    "--pass-to-x": `${to.x}%`,
    "--pass-to-y": `${to.y}%`,
    "--pass-from-scale": `${(0.74 + fromProgress * 0.36) * 0.75}`,
    "--pass-to-scale": `${0.74 + toProgress * 0.36}`,
    "--pass-delay": `${delayMs}ms`,
  } as CSSProperties;
};

export function NbaChainView({
  chain,
  links,
  target,
  targetReached = false,
  latestAcceptedLinkIndex,
  celebrateCompletion = false,
  connectionAnimationLabel = (from, to) => `Basketball lob from ${from} to ${to}`,
  completionLabel = "Alley-oop!",
  finishLabel = "Dunk!",
  onRemoveFromIndex,
  removePlayerLabel,
  className = "",
}: ChainPresentationProps) {
  const reached = targetReached || Boolean(target && chain.at(-1)?.id === target.id);
  const displayNodes = target && !reached ? [...chain, target] : [...chain];
  const nodeStep = displayNodes.length > 1 ? 1 / (displayNodes.length - 1) : 0;
  const latestLink = latestAcceptedLinkIndex === undefined
    ? undefined
    : links[latestAcceptedLinkIndex];

  return (
    <section
      className={`${styles.chainView} ${displayNodes.length > 7 ? styles.scrollable : ""} ${reached ? styles.completed : ""} ${reached && celebrateCompletion ? styles.celebrating : ""} ${className}`}
      aria-label="NBA teammate path approaching the basket"
    >
      <div
        className={`${styles.approach} ${displayNodes.length > 7 ? styles.dense : ""} ${displayNodes.length > 10 ? styles.veryDense : ""}`}
        data-node-count={displayNodes.length}
        style={{ "--court-art": `url("${courtArtworkUrl}")` } as CSSProperties}
      >
        <svg
          className={styles.connectionsLayer}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {links.map((link, index) => (
            <g key={`arc-${link.from.id}-${link.to.id}-${index}`}>
              <path
                className={styles.connectionShadow}
                d={connectionGeometry(nodeStep * index, nodeStep * (index + 1)).path}
                pathLength="1"
              />
              <path
                className={`${styles.connectionArc} ${index === latestAcceptedLinkIndex ? styles.latestConnection : ""}`}
                d={connectionGeometry(nodeStep * index, nodeStep * (index + 1)).path}
                pathLength="1"
              />
            </g>
          ))}
        </svg>

        {latestLink && latestAcceptedLinkIndex !== undefined ? (
          <span
            className={styles.passBall}
            style={passStyle(
              nodeStep * latestAcceptedLinkIndex,
              nodeStep * (latestAcceptedLinkIndex + 1),
              reached ? 0 : 330,
            )}
            role="img"
            aria-label={connectionAnimationLabel(latestLink.from.label, latestLink.to.label)}
            key={`${latestLink.from.id}-${latestLink.to.id}-${links.length}`}
          />
        ) : null}

        <div className={styles.hoop} role="img" aria-label={reached ? "Target reached: final dunk" : "Finish at the hoop"}>
          <span className={styles.backboard} aria-hidden="true" />
          <span className={styles.rim} aria-hidden="true" />
          <span className={styles.net} aria-hidden="true" />
          {reached ? <span className={styles.dunkBall} aria-hidden="true" /> : null}
          {reached ? <span className={styles.dunkLabel}>{finishLabel}</span> : null}
        </div>

        {reached && celebrateCompletion ? (
          <div className={styles.successCallout} aria-hidden="true">{completionLabel}</div>
        ) : null}

        <div className={styles.ringPlayers} role="list">
          {displayNodes.map((entity, index) => {
            const routeProgress = nodeStep * index;
            const isPendingTarget = !reached && index === displayNodes.length - 1 && index >= chain.length;
            const isTarget = Boolean(target && entity.id === target.id) || (reached && index === displayNodes.length - 1);
            const isCurrent = !isPendingTarget && !reached && index === chain.length - 1;
            const hasPassed = !isPendingTarget && index < chain.length - 1;
            return (
              <div
                className={`${styles.playerNode} ${isTarget ? styles.target : ""} ${isPendingTarget ? styles.pending : ""} ${isCurrent ? styles.current : ""} ${hasPassed ? styles.passed : ""} ${index === 0 && hasPassed ? styles.openingPasser : ""} ${reached && celebrateCompletion && isTarget ? styles.dunking : ""}`}
                style={positionStyle(routeProgress)}
                role="listitem"
                aria-current={isCurrent ? "step" : undefined}
                key={`${entity.id}-${index}`}
              >
                <div className={styles.playerPortraitWrap}>
                  <NbaPlayerPortrait entity={entity} size="large" />
                  {reached && celebrateCompletion && isTarget ? <span className={styles.catchBall} aria-hidden="true" /> : null}
                  {!isPendingTarget && index > 0 && onRemoveFromIndex ? (
                    <button
                      className={styles.removePlayer}
                      type="button"
                      onClick={() => onRemoveFromIndex(index)}
                      aria-label={removePlayerLabel?.(entity.label) ?? `Remove ${entity.label} and later players`}
                      title={removePlayerLabel?.(entity.label) ?? `Remove ${entity.label} and later players`}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
                <span className={styles.playerName}>{entity.label}</span>
              </div>
            );
          })}
        </div>

        {links.map((link, index) => {
          return (
            <div
              className={styles.edgeBadge}
              style={evidenceStyle(nodeStep * index, nodeStep * (index + 1), index)}
              key={`${link.from.id}-${link.to.id}-${index}`}
            >
              <span className={styles.srOnly}>{link.from.label} to {link.to.label}</span>
              <NbaTeamEvidence evidence={link.evidence} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
