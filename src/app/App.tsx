import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  pastDailySlates,
  selectDailySlate,
  type DailyEntry,
  type DailySchedule,
  type ResolvedDailySlate,
} from "../core/daily.ts";
import { ConnectionGraph } from "../core/graph.ts";
import {
  createGame,
  linkCount,
  nextShortestHint,
  type ConnectionHint,
  revealShortestPath,
  rewindGame,
  finishIfLinked,
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
import { dailyStats, loadDailySolves, recordDailySolve, type DailySolve, type DailySolves } from "../game/stats.ts";
import { PlayerSearch } from "./PlayerSearch.tsx";
import { AuthorLink, SiteHeader } from "../ui/SiteHeader.tsx";

const nbaAdapter = new NbaDataAdapter();
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

type GameMode = "daily" | "extra";
type AppMode = GameMode | "archive";
const ARCHIVE_PAGE_SIZE = 10;
/** Lets the lob to the newly added player land before the automatic final pass. */
const AUTO_FINISH_DELAY_MS = 1250;

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

const formatPuzzleDate = (date: string, locale: Locale): string =>
  new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));

function PastPuzzles({ slates, graph, namespace, locale, activeDate, onSelect }: {
  slates: readonly ResolvedDailySlate[];
  graph: ConnectionGraph;
  namespace: string;
  locale: Locale;
  activeDate?: string;
  onSelect: (slate: ResolvedDailySlate) => void;
}) {
  const copy = COPY[locale];
  const storage = useMemo(() => browserStorage(), []);
  const [visible, setVisible] = useState(ARCHIVE_PAGE_SIZE);
  const status = (slate: ResolvedDailySlate): { label: string; solved: boolean } => {
    const snapshot = loadProgress(storage, progressStorageKey(namespace, puzzleId(slate.easy, slate.date)));
    if (snapshot && snapshot.path.length > 1 && snapshot.path.at(-1) === slate.easy.targetId) {
      return { label: copy.archiveSolved(snapshot.path.length - 1), solved: true };
    }
    if (snapshot?.answerRevealed) return { label: copy.archiveRevealed, solved: false };
    if (snapshot && snapshot.path.length > 1) return { label: copy.archiveInProgress, solved: false };
    return { label: copy.archiveNotPlayed, solved: false };
  };
  return (
    <section id="past-puzzles" className="archive-panel" aria-label={copy.pastPuzzles}>
      <ol>
        {slates.slice(0, visible).map((slate) => {
          const progress = status(slate);
          return (
            <li key={slate.date}>
              <button type="button" aria-current={slate.date === activeDate ? "true" : undefined} onClick={() => onSelect(slate)}>
                <span className="archive-number">#{slate.index + 1}</span>
                <time dateTime={slate.date}>{formatPuzzleDate(slate.date, locale)}</time>
                <strong>{entityOrThrow(graph, slate.easy.startId).label}<span aria-hidden="true"> → </span>{entityOrThrow(graph, slate.easy.targetId).label}</strong>
                <span className={progress.solved ? "archive-status solved" : "archive-status"}>{progress.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {visible < slates.length ? (
        <button className="archive-more" type="button" onClick={() => setVisible((count) => count + ARCHIVE_PAGE_SIZE)}>{copy.showOlder}</button>
      ) : null}
    </section>
  );
}

function HeaderPopover({ title, children }: { title: string; children: ReactNode }) {
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: Event) => {
      const element = details.current;
      if (!element?.open) return;
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !element.contains(event.target as Node)) element.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  return (
    <details className="rules-popover" ref={details}>
      <summary>{title}</summary>
      {children}
    </details>
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
  onPlayAnother,
  onSolved,
  streak,
}: {
  graph: ConnectionGraph;
  puzzle: DailyEntry;
  date: string;
  locale: Locale;
  namespace: string;
  mode: GameMode;
  onNewMatchup?: () => void;
  onPlayAnother?: () => void;
  /** Called whenever the board is in a completed state, including when a finished game is reopened. */
  onSolved?: (solve: DailySolve) => void;
  /** Current daily streak, shown on the win panel when the puzzle counts toward it. */
  streak?: number;
}) {
  const copy = COPY[locale];
  const start = entityOrThrow(graph, puzzle.startId);
  const target = entityOrThrow(graph, puzzle.targetId);
  const storageKey = progressStorageKey(namespace, puzzleId(puzzle, date));
  const storage = useMemo(() => browserStorage(), []);
  const restored = useMemo(() => {
    const snapshot = loadProgress(storage, storageKey);
    const state = restoreGame(graph, puzzle.startId, puzzle.targetId, snapshot);
    return {
      state: finishIfLinked(graph, state)?.state ?? state,
      answerRevealed: Boolean(snapshot?.answerRevealed),
      hintsUsed: snapshot?.hintsUsed ?? 0,
    };
  }, [graph, puzzle.startId, puzzle.targetId, storage, storageKey]);
  const [game, setGame] = useState<GameState>(restored.state);
  const [answerRevealed, setAnswerRevealed] = useState(restored.answerRevealed);
  const [hint, setHint] = useState<ConnectionHint | null>(null);
  const [hintNamed, setHintNamed] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(restored.hintsUsed);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [latestLinkIndex, setLatestLinkIndex] = useState<number | undefined>();
  const [finishing, setFinishing] = useState(false);
  const finishTimer = useRef<number | undefined>(undefined);
  const cancelFinish = () => {
    window.clearTimeout(finishTimer.current);
    setFinishing(false);
  };
  useEffect(() => () => window.clearTimeout(finishTimer.current), []);

  const shortest = useMemo(
    () => graph.prominentShortestPath(puzzle.startId, puzzle.targetId),
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
  // The answer takes over the court; hiding it puts the player's own chain back.
  const showingAnswer = answerRevealed && optimalChain.length > 0;
  useEffect(() => {
    saveProgress(storage, storageKey, game, answerRevealed, hintsUsed);
  }, [answerRevealed, game, hintsUsed, storage, storageKey]);
  const shortestLinks = shortest?.links;
  useEffect(() => {
    if (game.won && shortestLinks !== undefined) onSolved?.({ links: linkCount(game), shortest: shortestLinks, hints: hintsUsed });
    // Report the result once, when the chain completes; later hint presses cannot change it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.won, onSolved]);

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
    setHint(null);
    setLatestLinkIndex(submission.state.path.length - 2);
    setFeedback({
      kind: "success",
      message: copy.connected(previous.label, entity.label),
      evidence: submission.evidence,
    });
    const finish = finishIfLinked(graph, submission.state);
    if (finish) {
      setFinishing(true);
      finishTimer.current = window.setTimeout(() => {
        setGame(finish.state);
        setLatestLinkIndex(finish.state.path.length - 2);
        setFeedback({ kind: "success", message: copy.autoFinished(entity.label, target.label), evidence: finish.evidence });
        setFinishing(false);
      }, AUTO_FINISH_DELAY_MS);
    }
    return true;
  };

  const toggleAnswer = () => {
    if (!answerRevealed) revealShortestPath(graph, game);
    setAnswerRevealed((visible) => !visible);
  };

  const showHint = () => {
    // First press shows the shared team; a second press on the same step names the player.
    if (hint) {
      if (hintNamed) return;
      setHintNamed(true);
      setHintsUsed((count) => count + 1);
      return;
    }
    const nextHint = nextShortestHint(graph, game, optimalIds);
    setHint(nextHint);
    setHintNamed(false);
    if (nextHint) {
      setHintsUsed((count) => count + 1);
      setFeedback(null);
    } else if (!game.won) setFeedback({ kind: "error", message: copy.noHint });
  };

  const rewindTo = (pathIndex: number) => {
    cancelFinish();
    let nextState = rewindGame(game, pathIndex);
    // A player who links to the target always finishes the chain, so they leave together.
    while (finishIfLinked(graph, nextState)) nextState = rewindGame(nextState, nextState.path.length - 2);
    if (nextState === game) return;
    setGame(nextState);
    setHint(null);
    setFeedback(null);
    setLatestLinkIndex(undefined);
  };

  const removeFromIndex = (pathIndex: number) => {
    rewindTo(pathIndex - 1);
  };

  const reset = () => {
    cancelFinish();
    clearProgress(storage, storageKey);
    setGame(createGame(puzzle.startId, puzzle.targetId));
    setAnswerRevealed(false);
    setHintsUsed(0);
    setHint(null);
    setFeedback(null);
    setLatestLinkIndex(undefined);
  };

  return (
    <section className="game-card" aria-label={`${mode === "daily" ? copy.today : copy.extraGame} ${namespace} puzzle`}>
      <div className={showingAnswer ? "chain-stage showing-answer" : "chain-stage"} aria-live="polite">
        <div className="stage-marking" aria-hidden="true" />
        {showingAnswer ? <p className="stage-caption">{copy.optimalTitle}</p> : null}
        <NbaChainView
          chain={showingAnswer ? optimalChain : chain}
          links={showingAnswer ? optimalLinks : links}
          target={target}
          targetReached={showingAnswer || game.won}
          latestAcceptedLinkIndex={showingAnswer ? undefined : latestLinkIndex}
          celebrateCompletion={game.won && !showingAnswer}
          connectionAnimationLabel={copy.connectionAnimation}
          completionLabel={copy.celebration}
          finishLabel={copy.finish}
          onRemoveFromIndex={showingAnswer ? undefined : removeFromIndex}
          removePlayerLabel={copy.removePlayer}
          startLabel={copy.start}
          targetLabel={copy.target}
          toolbar={(
            <>
              <div className="court-tools" role="group" aria-label={copy.assists}>
                <button className="tool-button" type="button" onClick={showHint} disabled={game.won || showingAnswer || finishing || (hint !== null && hintNamed)}>{hint ? copy.revealPlayer : copy.hint}</button>
                <button className="tool-button tool-primary" type="button" onClick={toggleAnswer}>
                  {answerRevealed ? copy.hideAnswer : copy.showAnswer}
                </button>
                {game.path.length > 1 && !showingAnswer ? (
                  <button className="tool-button" type="button" onClick={() => rewindTo(game.path.length - 2)}>{copy.undo}</button>
                ) : null}
              </div>
              {hint && !game.won && !showingAnswer ? (
                <aside className="court-hint" aria-live="polite" title={copy.hintTeam}>
                  <span>{copy.hintTitle}</span>
                  <NbaTeamClue evidence={hint.evidence} />
                  {hintNamed ? (
                    <strong><NbaPlayerPortrait entity={entityOrThrow(graph, hint.nextId)} size="small" />{entityOrThrow(graph, hint.nextId).label}</strong>
                  ) : null}
                </aside>
              ) : null}
            </>
          )}
        />
      </div>

      {showingAnswer ? (
        game.won ? null : <button className="tool-button stage-resume" type="button" onClick={toggleAnswer}>{copy.keepPlaying}</button>
      ) : !game.won && !finishing ? (
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

      {feedback && !showingAnswer ? <EvidenceCard feedback={feedback} copy={copy} /> : null}

      {game.won && shortest ? (
        <section className="win-panel" aria-live="polite">
          <div className="win-kicker"><span aria-hidden="true">✓</span>{copy.winTitle}</div>
          <h2>{copy.winBody(linkCount(game), shortest.links)}</h2>
          <div className="score-comparison">
            <div><strong>{linkCount(game)}</strong><span>{copy.links}</span></div>
            <span className="score-vs">vs</span>
            <div><strong>{shortest.links}</strong><span>{copy.shortest}</span></div>
            <div><strong>{hintsUsed}</strong><span>{copy.hints}</span></div>
          </div>
          {streak ? <p className="win-streak">{copy.streak(streak)}</p> : null}
          <button className="win-another-button" type="button" onClick={mode === "daily" ? onPlayAnother : onNewMatchup}>
            {mode === "daily" ? copy.playAnother : copy.newMatchup}<span aria-hidden="true">→</span>
          </button>
        </section>
      ) : null}

      <button className="reset-button" type="button" onClick={reset}>{copy.reset}</button>
    </section>
  );
}

export function App() {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [mode, setMode] = useState<AppMode>("daily");
  const [archiveSlate, setArchiveSlate] = useState<ResolvedDailySlate | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [solves, setSolves] = useState<DailySolves>({});
  const [extraPair, setExtraPair] = useState<DailyEntry | null>(null);
  const extraSerial = useRef(0);
  const [extraError, setExtraError] = useState<string | null>(null);
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
      setSolves(loadDailySolves(browserStorage(), nbaAdapter.id));
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
  const pastSlates = useMemo(
    () => loaded ? pastDailySlates(loaded.schedule, new Date()) : [],
    [loaded],
  );
  const shownSlate = mode === "archive" ? archiveSlate : slate;
  const displayDate = shownSlate ? formatPuzzleDate(shownSlate.date, locale) : "";
  const activePuzzle = loaded
    ? mode === "extra" ? extraPair : shownSlate?.easy ?? null
    : null;
  const boardMode: GameMode = mode === "extra" ? "extra" : "daily";

  const generateExtra = () => {
    if (!loaded) return;
    setArchiveOpen(false);
    try {
      const serial = extraSerial.current + 1;
      extraSerial.current = serial;
      setExtraPair(randomNbaPuzzle(loaded.graph, serial));
      setExtraError(null);
    } catch (reason: unknown) {
      setExtraError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  // Only today's puzzle, finished while it is still today, counts toward the streak.
  const recordTodaySolved = useCallback((solve: DailySolve) => {
    if (!loaded || !slate || selectDailySlate(loaded.schedule).date !== slate.date) return;
    setSolves(recordDailySolve(browserStorage(), loaded.namespace, slate.date, solve));
  }, [loaded, slate]);
  const stats = slate ? dailyStats(solves, slate.date) : null;

  const playAnother = () => {
    setArchiveOpen(false);
    setMode("extra");
    if (!extraPair) generateExtra();
  };

  return (
    <main className="site-shell">
      <SiteHeader locale={locale} onLocaleChange={setLocale} section="nba">
        <HeaderPopover title={copy.rulesTitle}>
          <ol>{copy.rules.map((rule) => <li key={rule}>{rule}</li>)}</ol>
        </HeaderPopover>
        <HeaderPopover title={copy.statsTitle}>
          <dl className="stats-panel">
            <div><dt>{copy.statSolved}</dt><dd>{stats?.solved ?? 0}</dd></div>
            <div><dt>{copy.statCurrent}</dt><dd>{stats?.current ?? 0}</dd></div>
            <div><dt>{copy.statBest}</dt><dd>{stats?.best ?? 0}</dd></div>
            <div><dt>{copy.statShortest}</dt><dd>{stats?.solved ? `${Math.round(100 * stats.matchedShortest / stats.solved)}%` : "–"}</dd></div>
          </dl>
        </HeaderPopover>
      </SiteHeader>

      <section className="hero">
        <div>
          <p className="eyebrow">{mode === "daily" ? copy.today : mode === "archive" ? copy.pastPuzzle : copy.moreGames}{mode !== "extra" && shownSlate ? ` · ${displayDate}` : ""}</p>
          <h1>{copy.heroTitle}</h1>
          <p>{mode === "daily" ? copy.heroBody : copy.extraBody}</p>
        </div>
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
          <div className="puzzle-navigation">
            <span>{mode === "extra" ? copy.extraGame : `${mode === "daily" ? copy.daily : copy.pastPuzzle} #${(shownSlate?.index ?? 0) + 1}`}</span>
            <div>
              {mode === "extra" ? <button type="button" onClick={generateExtra}>{copy.newMatchup}</button> : null}
              {pastSlates.length ? (
                <button type="button" aria-expanded={archiveOpen} aria-controls="past-puzzles" onClick={() => setArchiveOpen((open) => !open)}>
                  {copy.pastPuzzles}
                </button>
              ) : null}
              <button type="button" onClick={mode === "daily" ? playAnother : () => { setArchiveOpen(false); setMode("daily"); }}>
                {mode === "daily" ? copy.playAnother : copy.backToDaily}<span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
          {archiveOpen ? (
            <PastPuzzles
              slates={pastSlates}
              graph={loaded.graph}
              namespace={loaded.namespace}
              locale={locale}
              activeDate={mode === "archive" ? archiveSlate?.date : undefined}
              onSelect={(selected) => {
                setArchiveSlate(selected);
                setMode("archive");
                setArchiveOpen(false);
              }}
            />
          ) : null}
          {mode === "extra" && extraError ? (
            <p className="mode-error" role="alert">{copy.extraError}</p>
          ) : null}
          {activePuzzle ? (
            <GameBoard
              key={`${mode}-${activePuzzle.id ?? `${activePuzzle.startId}-${activePuzzle.targetId}`}`}
              graph={loaded.graph}
              puzzle={activePuzzle}
              date={mode === "extra" ? activePuzzle.id ?? "extra" : shownSlate?.date ?? ""}
              locale={locale}
              namespace={mode === "extra" ? `${loaded.namespace}:extra` : loaded.namespace}
              mode={boardMode}
              onNewMatchup={mode === "extra" ? generateExtra : undefined}
              onPlayAnother={mode === "extra" ? undefined : playAnother}
              onSolved={mode === "daily" ? recordTodaySolved : undefined}
              streak={mode === "daily" ? stats?.current : undefined}
            />
          ) : null}
        </>
      )}

      <footer className="site-footer">
        <p>{copy.dataNote}</p>
        <AuthorLink locale={locale} />
      </footer>
    </main>
  );
}
