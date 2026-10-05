import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Locale } from "./i18n/copy.ts";
import { AuthorLink, SiteHeader } from "./ui/SiteHeader.tsx";
import "./hub.css";

const baseUrl = import.meta.env.BASE_URL;
const initialLocale = (): Locale => {
  try { return localStorage.getItem("alleyloop:locale") === "zh" ? "zh" : "en"; }
  catch { return "en"; }
};

const HUB_COPY = {
  en: {
    title: "Alley Loop",
    subtitle: "A game about the connections you remember, and the ones you discover along the way.",
    body: "Six degrees of separation says any two people on Earth can be connected by a chain of six social links or fewer. Can you connect the links in the following categories?",
    categories: "Categories",
    play: "Play",
    coming: "Coming later",
    nba: "NBA",
    upcoming: ["Movies", "Soccer", "NFL"],
  },
  zh: {
    title: "Alley Loop",
    subtitle: "从你记得的联系出发，发现途中意想不到的联系。",
    body: "六度分隔理论认为，地球上任意两个人之间，最多通过六层人际关系就能联系起来。你能在下面这些类别里把他们连起来吗？",
    categories: "类别",
    play: "开始",
    coming: "稍后推出",
    nba: "NBA",
    upcoming: ["电影", "足球", "NFL"],
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
    <div className="hub-shell">
      <SiteHeader locale={locale} onLocaleChange={setLocale} />
      <main id="main-content">
        <section className="hub-hero" aria-labelledby="hub-title">
          <h1 id="hub-title">{copy.title}</h1>
          <p className="hub-subtitle">{copy.subtitle}</p>
          <p>{copy.body}</p>
        </section>

        <section className="hub-games" aria-label={copy.categories}>
          <a className="hub-banner" href={`${baseUrl}nba/`}>
            <img src={`${baseUrl}assets/nba-court-desktop.webp`} alt="" width="2048" height="1152" />
            <div className="hub-banner-copy">
              <h2>{copy.nba}</h2>
              <span className="hub-play-button">{copy.play}<span aria-hidden="true">→</span></span>
            </div>
          </a>

          <div className="hub-planned-grid">
            {copy.upcoming.map((name) => (
              <article className="hub-planned-card" key={name}>
                <h2>{name}</h2>
                <span className="hub-coming">{copy.coming}</span>
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer className="hub-footer">
        <AuthorLink locale={locale} />
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><HubApp /></StrictMode>);
