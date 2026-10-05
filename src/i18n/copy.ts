export type Locale = "en" | "zh";

export interface AlleyLoopCopy {
  today: string;
  daily: string;
  moreGames: string;
  extraGame: string;
  playAnother: string;
  backToDaily: string;
  pastPuzzles: string;
  pastPuzzle: string;
  showOlder: string;
  archiveSolved: (links: number) => string;
  archiveInProgress: string;
  archiveRevealed: string;
  archiveNotPlayed: string;
  extraBody: string;
  extraError: string;
  newMatchup: string;
  heroTitle: string;
  heroBody: string;
  start: string;
  target: string;
  loading: string;
  loadErrorTitle: string;
  loadErrorBody: string;
  searchPlaceholder: string;
  prompt: (player: string) => string;
  submit: string;
  submitting: string;
  choosePlayer: string;
  invalid: (from: string, to: string) => string;
  duplicate: string;
  connected: (from: string, to: string) => string;
  autoFinished: (from: string, target: string) => string;
  shared: string;
  allSeasons: string;
  assists: string;
  hint: string;
  hintTitle: string;
  hintTeam: string;
  revealPlayer: string;
  hintPlayerTitle: string;
  hints: string;
  streak: (days: number) => string;
  statsTitle: string;
  statSolved: string;
  statCurrent: string;
  statBest: string;
  statShortest: string;
  noHint: string;
  showAnswer: string;
  hideAnswer: string;
  keepPlaying: string;
  undo: string;
  removePlayer: (player: string) => string;
  connectionAnimation: (from: string, to: string) => string;
  celebration: string;
  finish: string;
  winTitle: string;
  winBody: (links: number, shortest: number) => string;
  optimalTitle: string;
  links: string;
  shortest: string;
  reset: string;
  rulesTitle: string;
  rules: readonly string[];
  noResults: string;
  alreadyUsed: string;
  photoFallback: string;
  dataNote: string;
}

export const COPY: Record<Locale, AlleyLoopCopy> = {
  en: {
    today: "Today’s NBA Alley Loop challenge",
    daily: "Daily",
    moreGames: "More games",
    extraGame: "Extra game",
    playAnother: "Play another game",
    backToDaily: "Back to today's game",
    pastPuzzles: "Past puzzles",
    pastPuzzle: "Past puzzle",
    showOlder: "Show older",
    archiveSolved: (links) => `Solved in ${links}`,
    archiveInProgress: "In progress",
    archiveRevealed: "Answer shown",
    archiveNotPlayed: "Not played",
    extraBody: "Want to keep playing? Try another approachable matchup whenever you like.",
    extraError: "A new matchup could not be generated. Try again.",
    newMatchup: "New matchup",
    heroTitle: "Build the alley-oop.",
    heroBody: "Connect the two players through teammates. Any valid completed chain wins.",
    start: "Start",
    target: "Target",
    loading: "Building today’s court…",
    loadErrorTitle: "The court could not load.",
    loadErrorBody: "Regenerate the NBA data, then refresh this page.",
    searchPlaceholder: "Search an NBA player…",
    prompt: (player) => `Who was ${player} teammates with?`,
    submit: "Throw the lob",
    submitting: "Checking…",
    choosePlayer: "Choose a player from the results first.",
    invalid: (from, to) => `${from} and ${to} do not share an NBA team season in this dataset. Try another player.`,
    duplicate: "That player is already in your chain.",
    connected: (from, to) => `${from} → ${to} is good!`,
    autoFinished: (from, target) => `${from} and ${target} were teammates, so that completes the chain.`,
    shared: "Shared roster",
    allSeasons: "All supporting seasons",
    assists: "Game help",
    hint: "Hint",
    hintTitle: "Team clue",
    hintTeam: "The next player shared this roster with your current player.",
    revealPlayer: "Reveal player",
    hintPlayerTitle: "Next player",
    hints: "Hints",
    streak: (days) => `${days}-day streak`,
    statsTitle: "Stats",
    statSolved: "Dailies solved",
    statCurrent: "Current streak",
    statBest: "Best streak",
    statShortest: "Matched shortest",
    noHint: "No unused route remains from here. Undo a player and try again.",
    showAnswer: "Show answer",
    hideAnswer: "Hide answer",
    keepPlaying: "Hide answer and keep playing",
    undo: "Undo",
    removePlayer: (player) => `Remove ${player} and later players`,
    connectionAnimation: (from, to) => `Basketball lob from ${from} to ${to}`,
    celebration: "ALLEY-OOP!",
    finish: "DUNK!",
    winTitle: "Alley-oop complete!",
    winBody: (links, shortest) => `Great finish — you won in ${links} links. The shortest possible connection is ${shortest}.`,
    optimalTitle: "One shortest alley-oop",
    links: "Your links",
    shortest: "Shortest",
    reset: "Start over",
    rulesTitle: "How to play",
    rules: [
      "Add a player who was a teammate of the last one: same team, same season.",
      "Reach the target. The final pass is thrown for you.",
      "Any chain wins. Fewer links is better.",
    ],
    noResults: "No matching NBA players.",
    alreadyUsed: "Already in this chain",
    photoFallback: "Photo unavailable",
    dataNote: "Unofficial fan prototype; not affiliated with or endorsed by the NBA. Roster links are derived from Kaggle datasets.",
  },
  zh: {
    today: "今日 NBA Alley Loop 挑战",
    daily: "每日挑战",
    moreGames: "更多游戏",
    extraGame: "额外游戏",
    playAnother: "再玩一局",
    backToDaily: "返回今日游戏",
    pastPuzzles: "往期题目",
    pastPuzzle: "往期题目",
    showOlder: "查看更早",
    archiveSolved: (links) => `${links} 步完成`,
    archiveInProgress: "进行中",
    archiveRevealed: "已看答案",
    archiveNotPlayed: "未挑战",
    extraBody: "想继续玩？随时试试另一组轻松的球员对。",
    extraError: "暂时无法生成新的对决，请重试。",
    newMatchup: "新的对决",
    heroTitle: "连起这一记空中接力。",
    heroBody: "通过曾经的队友连接两位球员。只要完成有效连接，就是胜利。",
    start: "起点",
    target: "目标",
    loading: "正在搭建今日球场…",
    loadErrorTitle: "球场加载失败。",
    loadErrorBody: "请重新生成 NBA 数据，然后刷新页面。",
    searchPlaceholder: "搜索 NBA 球员…",
    prompt: (player) => `谁曾与 ${player} 做过队友？`,
    submit: "传出空接",
    submitting: "正在验证…",
    choosePlayer: "请先从搜索结果中选择一位球员。",
    invalid: (from, to) => `在当前数据中，${from} 与 ${to} 没有同队同赛季记录。请换一位球员。`,
    duplicate: "这位球员已经在你的连接中。",
    connected: (from, to) => `${from} → ${to}，连接有效！`,
    autoFinished: (from, target) => `${from} 与 ${target} 曾是队友，连接就此完成。`,
    shared: "共同效力",
    allSeasons: "全部有效赛季",
    assists: "游戏辅助",
    hint: "提示",
    hintTitle: "球队提示",
    hintTeam: "下一位球员曾与当前球员在这支球队同队。",
    revealPlayer: "揭晓球员",
    hintPlayerTitle: "下一位球员",
    hints: "提示",
    streak: (days) => `连续 ${days} 天`,
    statsTitle: "战绩",
    statSolved: "已完成每日挑战",
    statCurrent: "当前连胜",
    statBest: "最佳连胜",
    statShortest: "达到最短路线",
    noHint: "从这里已没有未使用的路线。请撤回一位球员后重试。",
    showAnswer: "查看答案",
    hideAnswer: "收起答案",
    keepPlaying: "收起答案，继续挑战",
    undo: "撤回",
    removePlayer: (player) => `移除 ${player} 及之后的球员`,
    connectionAnimation: (from, to) => `篮球从 ${from} 空接传向 ${to}`,
    celebration: "空中接力！",
    finish: "灌篮！",
    winTitle: "空接完成！",
    winBody: (links, shortest) => `漂亮！你用 ${links} 次连接赢下本局。最短可能连接为 ${shortest} 次。`,
    optimalTitle: "一条最短空接路线",
    links: "你的连接数",
    shortest: "最短连接数",
    reset: "重新开始",
    rulesTitle: "玩法说明",
    rules: [
      "加入一位与上一位球员同队同赛季的队友。",
      "连到目标球员即可，最后一传会自动完成。",
      "任何有效连接都算赢，步数越少越好。",
    ],
    noResults: "没有匹配的 NBA 球员。",
    alreadyUsed: "已在当前连接中",
    photoFallback: "暂无照片",
    dataNote: "非官方球迷原型，与 NBA 无隶属或代言关系。阵容连接来自 Kaggle 数据集。",
  },
};
