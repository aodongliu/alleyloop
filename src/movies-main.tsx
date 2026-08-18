import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./movie-preview.css";

const baseUrl = import.meta.env.BASE_URL;

function MoviePreview() {
  const [locale, setLocale] = useState<"en" | "zh">("en");
  const copy = locale === "zh" ? {
    status: "尚未开放 · 不可游玩",
    title: "电影连接即将到来。",
    body: "电影图谱仍在准备中。我们需要在适合预处理的机器上整理本地 IMDb 快照，然后才能把演员、导演和编剧通过共同电影连接起来。",
    note: "此页面只是预告，不会加载数据，也没有可玩的题目。",
    back: "← 返回 AlleyLoop",
    available: "NBA 目前仍可游玩",
    language: "语言 / Language",
  } : {
    status: "Coming later · Not playable",
    title: "Movie connections are coming later.",
    body: "The film graph is still being prepared. A local IMDb snapshot needs preprocessing on a machine suited to the job before actors, directors, and writers can connect through shared movies.",
    note: "This is a preview only: it does not load data and has no playable puzzles.",
    back: "← Back to AlleyLoop",
    available: "NBA remains playable",
    language: "Language / 语言",
  };
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);
  return (
    <main className="movie-preview-shell">
      <header><a href={baseUrl}>{copy.back}</a><div className="movie-preview-actions"><span>{copy.status}</span><div className="movie-preview-language" aria-label={copy.language}><button type="button" className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")}>EN</button><button type="button" className={locale === "zh" ? "active" : ""} onClick={() => setLocale("zh")}>中文</button></div></div></header>
      <section>
        <p>{copy.status}</p>
        <h1>{copy.title}</h1>
        <div className="preview-filmstrip" aria-hidden="true"><i /><i /><i /><i /><i /></div>
        <strong>{copy.body}</strong>
        <p className="movie-preview-note">{copy.note}</p>
        <div className="movie-preview-footer"><span>{copy.available}</span><a href={`${baseUrl}nba/`}>Open NBA ↗</a></div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><MoviePreview /></StrictMode>);
