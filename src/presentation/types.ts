import type { ConnectionEvidence, Entity } from "../core/model.ts";

/** Sport-neutral data contract consumed by any chain presentation. */
export interface PresentationLink {
  from: Entity;
  to: Entity;
  evidence: readonly ConnectionEvidence[];
}

export interface ChainPresentationProps {
  chain: readonly Entity[];
  links: readonly PresentationLink[];
  /** Optional unreached endpoint so a presentation can show the remaining route. */
  target?: Entity;
  targetReached?: boolean;
  latestAcceptedLinkIndex?: number;
  /** Enables the presentation's completion choreography for the playable chain. */
  celebrateCompletion?: boolean;
  connectionAnimationLabel?: (from: string, to: string) => string;
  completionLabel?: string;
  finishLabel?: string;
  /** Remove the selected player and every player after it. The start is index 0. */
  onRemoveFromIndex?: (index: number) => void;
  removePlayerLabel?: (player: string) => string;
  className?: string;
}

export interface PortraitProps {
  entity: Entity;
  size?: "small" | "large";
  className?: string;
}
