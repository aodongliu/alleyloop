import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Locale } from "./i18n/copy.ts";
import "./hub.css";

const baseUrl = import.meta.env.BASE_URL;
const initialLocale = (): Locale => {
  try { return localStorage.getItem("alleyloop:locale") === "zh" ? "zh" : "en"; }
  catch { return "en"; }
};

const HUB_COPY = {
  en: {
    eyebrow: "One engine · many worlds",
    title: "Find the link.",
    body: "Choose a court, a screen, or a field. Build any valid chain and compare it with the shortest route.",
    choose: "Choose today’s AlleyLoop",
    ready: "Play now",
    coming: "Coming later",
    planned: "Planned",
    nbaTitle: "NBA",
    nbaBody: "Connect players through same-team, same-season rosters. Finish at the rim.",
    movieTitle: "Movies",
    movieBody: "Connect actors, directors, and writers through shared principal film credits.",
    soccerBody: "Pass through club teammates and finish in the goal.",
    nflBody: "Move the chain through NFL team-season connections.",
    local: "NBA is playable now. Movies, soccer, and NFL remain architecture-ready placeholders.",
  },
  zh: {
    eyebrow: "同一引擎 · 多个世界",
    title: "找出连接。",
    body: "选择球场、银幕或绿茵场。完成任意有效路线，再与最短路线比较。",
    choose: "选择今天的 AlleyLoop",
    ready: "开始游戏",
    coming: "稍后推出",
    planned: "计划中",
    nbaTitle: "NBA",
    nbaBody: "通过同队同赛季阵容连接球员，最后在篮筐前完成空接。",
    movieTitle: "电影",
    movieBody: "通过共同的主要电影演职员表连接演员、导演与编剧。",
    soccerBody: "通过俱乐部队友传递，最后射门得分。",
    nflBody: "通过 NFL 同队同赛季关系推进连接。",
    local: "NBA 现已可玩。电影、足球和 NFL 目前保留为可扩展的占位页面。",
  },
} as const;

function HubApp() {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const copy = HUB_COPY[locale];
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    try { localStorage.setItem("alleyloop:locale", locale); } catch { /* preference is optional */ }
  }, [locale]);

  return (
    <main className="hub-shell">
      <header className="hub-header">
        <a className="hub-wordmark" href={baseUrl}><span aria-hidden="true">∞</span> AlleyLoop</a>
        <div className="hub-language" aria-label="Language / 语言">
          <button type="button" className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")}>EN</button>
          <button type="button" className={locale === "zh" ? "active" : ""} onClick={() => setLocale("zh")}>中文</button>
        </div>
      </header>

      <section className="hub-hero">
        <p>{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <div className="hub-route" aria-hidden="true"><i /><i /><i /><i /></div>
        <strong>{copy.body}</strong>
      </section>

      <section className="hub-games" aria-labelledby="hub-games-title">
        <h2 id="hub-games-title">{copy.choose}</h2>
        <div className="hub-grid">
          <a className="game-tile nba-tile" href={`${baseUrl}nba/`}>
            <span className="tile-status">{copy.ready}</span>
            <div className="tile-mark basketball-mark" aria-hidden="true" />
            <h3>{copy.nbaTitle}</h3>
            <p>{copy.nbaBody}</p>
            <b aria-hidden="true">↗</b>
          </a>
          <a className="game-tile movie-tile" href={`${baseUrl}movies/`}>
            <span className="tile-status">{copy.coming}</span>
            <div className="tile-mark film-mark" aria-hidden="true"><i /><i /><i /></div>
            <h3>{copy.movieTitle}</h3>
            <p>{copy.movieBody}</p>
            <b aria-hidden="true">↗</b>
          </a>
          <article className="game-tile future-tile">
            <span className="tile-status">{copy.planned}</span>
            <div className="tile-mark soccer-mark" aria-hidden="true" />
            <h3>Soccer</h3>
            <p>{copy.soccerBody}</p>
          </article>
          <article className="game-tile future-tile">
            <span className="tile-status">{copy.planned}</span>
            <div className="tile-mark football-mark" aria-hidden="true" />
            <h3>NFL</h3>
            <p>{copy.nflBody}</p>
          </article>
        </div>
      </section>

      <footer className="hub-footer">{copy.local}</footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><HubApp /></StrictMode>);
