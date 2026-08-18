import { useEffect, useMemo, useRef, useState } from "react";
import {
  selectDailySlate,
  type DailyDifficulty,
  type DailyEntry,
  type DailySchedule,
} from "../core/daily.ts";
import { ConnectionGraph } from "../core/graph.ts";
import {
  createGame,
  linkCount,
  nextShortestHint,
  revealShortestPath,
  rewindGame,
  submitConnection,
  type GameState,
} from "../core/game.ts";
import type { ConnectionEvidence, Entity } from "../core/model.ts";
import {
  clearProgress,
  loadProgress,
  progressStorageKey,
  restoreGame,
  saveProgress,
  type StorageLike,
} from "../game/persistence.ts";
import { COPY, type AlleyLoopCopy, type Locale } from "../i18n/copy.ts";
import type { PresentationLink } from "../presentation/types.ts";
import { NbaDataAdapter } from "../sports/nba/data/loadNbaGameData.ts";
import { randomNbaPuzzle } from "../sports/nba/data/randomNbaPuzzle.ts";
import { NbaChainView } from "../sports/nba/presentation/NbaChainView.tsx";
import { NbaPlayerCareer } from "../sports/nba/presentation/NbaPlayerCareer.tsx";
import { NbaPlayerPortrait } from "../sports/nba/presentation/NbaPlayerPortrait.tsx";
import { NbaTeamClue } from "../sports/nba/presentation/NbaTeamClue.tsx";
import { NbaTeamEvidence } from "../sports/nba/presentation/NbaTeamEvidence.tsx";
import { shortSeasonLabel } from "../sports/nba/presentation/teamEvidence.ts";
import { PlayerSearch } from "./PlayerSearch.tsx";

const nbaAdapter = new NbaDataAdapter();
const appBaseUrl = import.meta.env.BASE_URL;
const memoryOnlyStorage: StorageLike = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const browserStorage = (): StorageLike => {
  try {
    return window.localStorage;
  } catch {
    return memoryOnlyStorage;
  }
};

interface LoadedGame {
  namespace: string;
  graph: ConnectionGraph;
  schedule: DailySchedule;
  source?: Record<string, unknown>;
}

interface Feedback {
  kind: "success" | "error";
  message: string;
  evidence?: readonly ConnectionEvidence[];
}

type GameMode = "daily" | "unlimited";

const initialLocale = (): Locale => {
  try {
    return localStorage.getItem("alleyloop:locale") === "zh" ? "zh" : "en";
  } catch {
    return "en";
  }
};

const entityOrThrow = (graph: ConnectionGraph, id: string): Entity => {
  const entity = graph.getEntity(id);
  if (!entity) throw new Error(`Puzzle references unknown entity ${id}`);
  return entity;
};

const puzzleId = (puzzle: DailyEntry, date: string): string =>
  puzzle.id ?? `${date}-${puzzle.difficulty}-${puzzle.startId}-${puzzle.targetId}`;

function EndpointCard({ entity, label, target = false }: { entity: Entity; label: string; target?: boolean }) {
  const activeFrom = typeof entity.metadata?.activeFrom === "string" ? entity.metadata.activeFrom : null;
  const activeTo = typeof entity.metadata?.activeTo === "string" ? entity.metadata.activeTo : null;
  const activeRange = activeFrom && activeTo
    ? activeFrom === activeTo
      ? shortSeasonLabel(activeFrom)
      : `${shortSeasonLabel(activeFrom)}–${shortSeasonLabel(activeTo)}`
    : "";
  return (
    <article className={target ? "endpoint-card endpoint-target" : "endpoint-card"}>
      <span className="endpoint-label">{label}</span>
      <NbaPlayerPortrait entity={entity} size="large" />
      <strong>{entity.label}</strong>
      <small>{activeRange}</small>
    </article>
  );
}

function EvidenceCard({ feedback, copy }: { feedback: Feedback; copy: AlleyLoopCopy }) {
  return (
    <div className={`feedback ${feedback.kind}`} role={feedback.kind === "error" ? "alert" : "status"}>
      <span className="feedback-icon" aria-hidden="true">{feedback.kind === "success" ? "✓" : "×"}</span>
      <div>
        <strong>{feedback.message}</strong>
        {feedback.evidence?.length ? (
          <div className="feedback-evidence" aria-label={copy.shared}>
            <NbaTeamEvidence evidence={feedback.evidence} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GameBoard({
  graph,
  puzzle,
  date,
  locale,
  namespace,
  mode,
  onNewMatchup,
}: {
  graph: ConnectionGraph;
  puzzle: DailyEntry;
  date: string;
  locale: Locale;
  namespace: string;
  mode: GameMode;
  onNewMatchup?: () => void;
}) {
  const copy = COPY[locale];
  const start = entityOrThrow(graph, puzzle.startId);
  const target = entityOrThrow(graph, puzzle.targetId);
  const storageKey = progressStorageKey(namespace, puzzleId(puzzle, date));
  const storage = useMemo(() => browserStorage(), []);
  const restored = useMemo(() => {
    const snapshot = loadProgress(storage, storageKey);
    return {
      state: restoreGame(graph, puzzle.startId, puzzle.targetId, snapshot),
      answerRevealed: Boolean(snapshot?.answerRevealed),
    };
  }, [graph, puzzle.startId, puzzle.targetId, storage, storageKey]);
  const [game, setGame] = useState<GameState>(restored.state);
  const [answerRevealed, setAnswerRevealed] = useState(restored.answerRevealed);
  const [hintEvidence, setHintEvidence] = useState<readonly ConnectionEvidence[] | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [latestLinkIndex, setLatestLinkIndex] = useState<number | undefined>();

  const shortest = useMemo(
    () => graph.shortestPath(puzzle.startId, puzzle.targetId),
    [graph, puzzle.startId, puzzle.targetId],
  );
  const chain = useMemo(
    () => game.path.map((id) => entityOrThrow(graph, id)),
    [game.path, graph],
  );
  const links = useMemo<PresentationLink[]>(() => chain.slice(1).map((entity, index) => ({
    from: chain[index],
    to: entity,
    evidence: graph.sharedEvidence(chain[index].id, entity.id),
  })), [chain, graph]);
  const featuredOptimalPath = puzzle.featuredOptimalPath;
  const optimalIds = useMemo(() => {
    if (featuredOptimalPath) {
      const validation = graph.validateChain(featuredOptimalPath);
      if (validation.valid
        && featuredOptimalPath[0] === puzzle.startId
        && featuredOptimalPath.at(-1) === puzzle.targetId
        && featuredOptimalPath.length - 1 === shortest?.links) {
        return featuredOptimalPath;
      }
    }
    return shortest?.ids ?? [];
  }, [featuredOptimalPath, graph, puzzle.startId, puzzle.targetId, shortest]);
  const optimalChain = useMemo(
    () => optimalIds.map((id) => entityOrThrow(graph, id)),
    [graph, optimalIds],
  );
  const optimalLinks = useMemo<PresentationLink[]>(() => optimalChain.slice(1).map((entity, index) => ({
    from: optimalChain[index],
    to: entity,
    evidence: graph.sharedEvidence(optimalChain[index].id, entity.id),
  })), [graph, optimalChain]);
  useEffect(() => {
    saveProgress(storage, storageKey, game, answerRevealed);
  }, [answerRevealed, game, storage, storageKey]);

  const addPlayer = (entity: Entity): boolean => {
    const previous = chain.at(-1) ?? start;
    const submission = submitConnection(graph, game, entity.id);
    if (submission.duplicate) {
      setFeedback({ kind: "error", message: copy.duplicate });
      return false;
    }
    if (!submission.accepted) {
      setFeedback({ kind: "error", message: copy.invalid(previous.label, entity.label) });
      return false;
    }
    setGame(submission.state);
    setHintEvidence(null);
    setLatestLinkIndex(submission.state.path.length - 2);
    setFeedback({
      kind: "success",
      message: copy.connected(previous.label, entity.label),
      evidence: submission.evidence,
    });
    return true;
  };

  const toggleAnswer = () => {
    if (!answerRevealed) revealShortestPath(graph, game);
    setAnswerRevealed((visible) => !visible);
  };

  const showHint = () => {
    const hint = nextShortestHint(graph, game);
    setHintEvidence(hint?.evidence ?? null);
    if (hint) setFeedback(null);
    else if (!game.won) setFeedback({ kind: "error", message: copy.noHint });
  };

  const rewindTo = (pathIndex: number) => {
    const nextState = rewindGame(game, pathIndex);
    if (nextState === game) return;
    setGame(nextState);
    setHintEvidence(null);
    setFeedback(null);
    setLatestLinkIndex(undefined);
  };

  const removeFromIndex = (pathIndex: number) => {
    rewindTo(pathIndex - 1);
  };

  const reset = () => {
    clearProgress(storage, storageKey);
    setGame(createGame(puzzle.startId, puzzle.targetId));
    setAnswerRevealed(false);
    setHintEvidence(null);
    setFeedback(null);
    setLatestLinkIndex(undefined);
  };

  return (
    <section className="game-card" aria-label={`${puzzle.difficulty} ${namespace} puzzle`}>
      <div className="matchup">
        <EndpointCard entity={start} label={copy.start} />
        <div className="matchup-flight" aria-hidden="true">
          <span className="flight-ball" />
          <span className="flight-copy">CONNECT</span>
        </div>
        <EndpointCard entity={target} label={copy.target} target />
      </div>

      <div className="game-tools" aria-label={copy.assists}>
        {mode === "unlimited" && onNewMatchup ? (
          <button className="tool-button tool-new-matchup" type="button" onClick={onNewMatchup}>{copy.newMatchup}</button>
        ) : null}
        <button className="tool-button" type="button" onClick={showHint} disabled={game.won}>{copy.hint}</button>
        <button className="tool-button tool-primary" type="button" onClick={toggleAnswer}>
          {answerRevealed ? copy.hideAnswer : copy.showAnswer}
        </button>
        {game.path.length > 1 ? (
          <button className="tool-button" type="button" onClick={() => rewindTo(game.path.length - 2)}>{copy.undo}</button>
        ) : null}
      </div>

      {hintEvidence && !game.won ? (
        <aside className="hint-card" aria-live="polite">
          <div><span>{copy.hintTitle}</span><strong>{copy.hintTeam}</strong></div>
          <NbaTeamClue evidence={hintEvidence} />
        </aside>
      ) : null}

      <div className="chain-stage">
        <div className="stage-marking" aria-hidden="true" />
        <NbaChainView
          chain={chain}
          links={links}
          target={target}
          targetReached={game.won}
          latestAcceptedLinkIndex={latestLinkIndex}
          celebrateCompletion={game.won}
          connectionAnimationLabel={copy.connectionAnimation}
          completionLabel={copy.celebration}
          finishLabel={copy.finish}
          onRemoveFromIndex={removeFromIndex}
          removePlayerLabel={copy.removePlayer}
        />
      </div>

      {!game.won ? (
        <PlayerSearch
          graph={graph}
          currentPlayer={chain.at(-1) ?? start}
          usedIds={game.path}
          copy={copy}
          portrait={NbaPlayerPortrait}
          resultMeta={(entity) => (
            <NbaPlayerCareer
              playerLabel={entity.label}
              evidence={graph.membershipEvidence(entity.id)}
            />
          )}
          onSubmit={addPlayer}
        />
      ) : null}

      {feedback ? <EvidenceCard feedback={feedback} copy={copy} /> : null}

      {answerRevealed && optimalChain.length ? (
        <section className="optimal-path assist-answer" aria-live="polite">
          <h3>{copy.optimalTitle}</h3>
          <NbaChainView
            chain={optimalChain}
            links={optimalLinks}
            targetReached
            completionLabel={copy.celebration}
            finishLabel={copy.finish}
          />
        </section>
      ) : null}

      {game.won && shortest ? (
        <section className="win-panel" aria-live="polite">
          <div className="win-kicker"><span aria-hidden="true">✓</span>{copy.winTitle}</div>
          <h2>{copy.winBody(linkCount(game), shortest.links)}</h2>
          <div className="score-comparison">
            <div><strong>{linkCount(game)}</strong><span>{copy.links}</span></div>
            <span className="score-vs">vs</span>
            <div><strong>{shortest.links}</strong><span>{copy.shortest}</span></div>
          </div>
        </section>
      ) : null}

      <button className="reset-button" type="button" onClick={reset}>{copy.reset}</button>
    </section>
  );
}

export function App() {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [difficulty, setDifficulty] = useState<DailyDifficulty>("easy");
  const [mode, setMode] = useState<GameMode>("daily");
  const [unlimitedPair, setUnlimitedPair] = useState<DailyEntry | null>(null);
  const unlimitedSerial = useRef(0);
  const [unlimitedError, setUnlimitedError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<LoadedGame | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const copy = COPY[locale];

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    try { localStorage.setItem("alleyloop:locale", locale); } catch { /* optional preference */ }
  }, [locale]);

  useEffect(() => {
    let cancelled = false;
    nbaAdapter.load().then(({ dataset, schedule }) => {
      if (cancelled) return;
      const graph = new ConnectionGraph(dataset.entities, dataset.groups);
      selectDailySlate(schedule, new Date(), graph);
      setLoaded({ namespace: nbaAdapter.id, graph, schedule, source: dataset.source });
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason : new Error(String(reason)));
    });
    return () => { cancelled = true; };
  }, []);

  const slate = useMemo(
    () => loaded ? selectDailySlate(loaded.schedule, new Date(), loaded.graph) : null,
    [loaded],
  );
  const displayDate = slate ? new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: loaded?.schedule.timeZone,
  }).format(new Date(`${slate.date}T12:00:00Z`)) : "";
  const activePuzzle = loaded
    ? mode === "daily" ? slate?.[difficulty] ?? null : unlimitedPair
    : null;

  const generateUnlimited = (nextDifficulty: DailyDifficulty) => {
    if (!loaded) return;
    try {
      const serial = unlimitedSerial.current + 1;
      unlimitedSerial.current = serial;
      setUnlimitedPair(randomNbaPuzzle(loaded.graph, nextDifficulty, serial));
      setUnlimitedError(null);
    } catch (reason: unknown) {
      setUnlimitedError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const changeMode = (nextMode: GameMode) => {
    setMode(nextMode);
    if (nextMode === "unlimited" && (!unlimitedPair || unlimitedPair.difficulty !== difficulty)) {
      generateUnlimited(difficulty);
    }
  };

  const changeDifficulty = (nextDifficulty: DailyDifficulty) => {
    setDifficulty(nextDifficulty);
    if (mode === "unlimited") generateUnlimited(nextDifficulty);
  };

  return (
    <main className="site-shell">
      <header className="site-header">
        <a className="wordmark" href={appBaseUrl} aria-label="AlleyLoop home">
          <span className="wordmark-ball" aria-hidden="true"><i /></span>
          AlleyLoop
        </a>
        <div className="header-actions">
          <details className="rules-popover">
            <summary>{copy.rulesTitle}</summary>
            <div>
              <p>{copy.rulesBody}</p>
              <p>{copy.ruleDefinition}</p>
            </div>
          </details>
          <div className="language-switch" aria-label="Language / 语言">
            <button type="button" className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")}>EN</button>
            <button type="button" className={locale === "zh" ? "active" : ""} onClick={() => setLocale("zh")}>中文</button>
          </div>
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">{mode === "daily" ? copy.today : copy.unlimited}{mode === "daily" && slate ? ` · ${displayDate}` : ""}</p>
          <h1>{copy.heroTitle}</h1>
          <p>{mode === "daily" ? copy.heroBody : copy.unlimitedBody}</p>
        </div>
        <div className="hero-loop" aria-hidden="true"><span>PASS</span><i /><span>DUNK</span></div>
      </section>

      {error ? (
        <section className="load-state error-state" role="alert">
          <span aria-hidden="true">!</span>
          <div><h2>{copy.loadErrorTitle}</h2><p>{copy.loadErrorBody}</p><small>{error.message}</small></div>
        </section>
      ) : !loaded || !slate ? (
        <section className="load-state"><span className="loading-ball" aria-hidden="true" /><p>{copy.loading}</p></section>
      ) : (
        <>
          <nav className="mode-tabs" aria-label="Game mode">
            <button type="button" className={mode === "daily" ? "active" : ""} aria-pressed={mode === "daily"} onClick={() => changeMode("daily")}>
              <span>01</span>{copy.daily}<small>{copy.today}</small>
            </button>
            <button type="button" className={mode === "unlimited" ? "active" : ""} aria-pressed={mode === "unlimited"} onClick={() => changeMode("unlimited")}>
              <span>02</span>{copy.unlimited}<small>∞</small>
            </button>
          </nav>
          <nav className="difficulty-tabs" aria-label="Puzzle difficulty">
            <button type="button" className={difficulty === "easy" ? "active" : ""} aria-pressed={difficulty === "easy"} onClick={() => changeDifficulty("easy")}>
              <span>01</span>{copy.easy}<small>≤ 4</small>
            </button>
            <button type="button" className={difficulty === "hard" ? "active" : ""} aria-pressed={difficulty === "hard"} onClick={() => changeDifficulty("hard")}>
              <span>02</span>{copy.hard}<small>4–6</small>
            </button>
          </nav>
          {mode === "unlimited" && unlimitedError ? (
            <p className="mode-error" role="alert">{copy.unlimitedError}</p>
          ) : null}
          {activePuzzle ? (
            <GameBoard
              key={`${mode}-${activePuzzle.id ?? `${activePuzzle.startId}-${activePuzzle.targetId}`}`}
              graph={loaded.graph}
              puzzle={activePuzzle}
              date={mode === "daily" ? slate?.date ?? "" : activePuzzle.id ?? "unlimited"}
              locale={locale}
              namespace={mode === "daily" ? loaded.namespace : `${loaded.namespace}:unlimited:${difficulty}`}
              mode={mode}
              onNewMatchup={mode === "unlimited" ? () => generateUnlimited(difficulty) : undefined}
            />
          ) : null}
        </>
      )}

      <footer className="site-footer">
        <p>{copy.dataNote}</p>
        {loaded ? <span>{loaded.graph.entities().length.toLocaleString()} players · {loaded.graph.groups().length.toLocaleString()} team seasons</span> : null}
      </footer>
    </main>
  );
}
