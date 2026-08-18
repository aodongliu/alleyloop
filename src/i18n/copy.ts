export type Locale = "en" | "zh";

export interface AlleyLoopCopy {
  today: string;
  daily: string;
  unlimited: string;
  unlimitedBody: string;
  unlimitedError: string;
  newMatchup: string;
  heroTitle: string;
  heroBody: string;
  easy: string;
  hard: string;
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
  shared: string;
  allSeasons: string;
  assists: string;
  hint: string;
  hintTitle: string;
  hintTeam: string;
  noHint: string;
  showAnswer: string;
  hideAnswer: string;
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
  rulesBody: string;
  ruleDefinition: string;
  noResults: string;
  alreadyUsed: string;
  photoFallback: string;
  dataNote: string;
}

export const COPY: Record<Locale, AlleyLoopCopy> = {
  en: {
    today: "Today’s NBA teammate challenge",
    daily: "Daily",
    unlimited: "Unlimited",
    unlimitedBody: "Keep the runs going with a fresh pair whenever you want.",
    unlimitedError: "A new matchup could not be generated. Try again.",
    newMatchup: "New matchup",
    heroTitle: "Build the alley-oop.",
    heroBody: "Connect the two players through teammates. Any valid completed chain wins.",
    easy: "Easy",
    hard: "Hard",
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
    shared: "Shared roster",
    allSeasons: "All supporting seasons",
    assists: "Game help",
    hint: "Hint",
    hintTitle: "Team clue",
    hintTeam: "The next player shared this roster with your current player.",
    noHint: "No unused route remains from here. Undo a player and try again.",
    showAnswer: "Show answer",
    hideAnswer: "Hide answer",
    undo: "Undo last player",
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
    rulesBody: "Enter a player who was teammates with the player before them. Invalid guesses do not end the game, and you never need the mathematically shortest path to win.",
    ruleDefinition: "For this NBA version, two players count as teammates when they appear on the same NBA team’s roster records in the same season. Matchup endpoints entered the league in 1996–97 or later; your connecting players may come from any era.",
    noResults: "No matching NBA players.",
    alreadyUsed: "Already in this chain",
    photoFallback: "Photo unavailable",
    dataNote: "Unofficial fan prototype; not affiliated with or endorsed by the NBA. Roster links are derived from competitive-game appearances in the supplied Kaggle files.",
  },
  zh: {
    today: "今日 NBA 队友挑战",
    daily: "每日挑战",
    unlimited: "无限模式",
    unlimitedBody: "随时生成新的球员对，继续挑战。",
    unlimitedError: "暂时无法生成新的对决，请重试。",
    newMatchup: "新的对决",
    heroTitle: "连起这一记空中接力。",
    heroBody: "通过曾经的队友连接两位球员。只要完成有效连接，就是胜利。",
    easy: "简单",
    hard: "困难",
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
    shared: "共同效力",
    allSeasons: "全部有效赛季",
    assists: "游戏辅助",
    hint: "提示",
    hintTitle: "球队提示",
    hintTeam: "下一位球员曾与当前球员在这支球队同队。",
    noHint: "从这里已没有未使用的路线。请撤回一位球员后重试。",
    showAnswer: "查看答案",
    hideAnswer: "收起答案",
    undo: "撤回上一位球员",
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
    rulesBody: "输入一位曾与上一位球员做过队友的球员。无效猜测不会结束游戏，获胜也不要求最短路径。",
    ruleDefinition: "NBA 版本中，如果两位球员在同一赛季出现在同一支 NBA 球队的阵容记录里，就算做过队友。对决两端的球员须在 1996–97 赛季或之后进入联盟；中间连接球员可来自任何年代。",
    noResults: "没有匹配的 NBA 球员。",
    alreadyUsed: "已在当前连接中",
    photoFallback: "暂无照片",
    dataNote: "非官方球迷原型，与 NBA 无隶属或代言关系。阵容连接来自所提供 Kaggle 数据中的正式比赛出场记录。",
  },
};
