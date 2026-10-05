import { useEffect, useState, type ReactNode } from "react";
import type { Locale } from "../i18n/copy.ts";
import "./design.css";

type Theme = "light" | "dark";
const themeKey = "aodong-theme-v2";
const baseUrl = import.meta.env.BASE_URL;

function ThemeToggle({ locale }: { locale: Locale }) {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#302e2c" : "#f3efe7");
  }, [theme]);

  useEffect(() => {
    const syncTheme = (event: StorageEvent) => {
      if (event.key === themeKey || event.key === null) setTheme(event.newValue === "dark" ? "dark" : "light");
    };
    window.addEventListener("storage", syncTheme);
    return () => window.removeEventListener("storage", syncTheme);
  }, []);

  const label = locale === "zh"
    ? `切换为${theme === "dark" ? "浅色" : "深色"}主题`
    : `Switch to ${theme === "dark" ? "light" : "dark"} theme`;

  return (
    <button className="al-theme-toggle" type="button" aria-label={label} title={label} onClick={() => {
      const next = theme === "dark" ? "light" : "dark";
      setTheme(next);
      try { localStorage.setItem(themeKey, next); } catch { /* Theme works without storage. */ }
    }}>
      <span aria-hidden="true">◐</span>
    </button>
  );
}

/** Footer credit shared by every page; the header's site link is hidden on phones. */
export function AuthorLink({ locale }: { locale: Locale }) {
  return (
    <a className="al-author" href="https://aodongliu.github.io/">
      {locale === "zh" ? "作者：" : "Author: "}<span>Aodong Liu</span>
    </a>
  );
}

export function SiteHeader({ locale, onLocaleChange, section, children }: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  section?: "nba";
  children?: ReactNode;
}) {
  return (
    <header className="al-header">
      <div className="al-brand-group">
        <a className="al-brand" href={baseUrl} aria-label={locale === "zh" ? "AlleyLoop 首页" : "AlleyLoop home"}>
          <span className="al-brand-mark" aria-hidden="true">∞</span>
          AlleyLoop
        </a>
        {section ? <span className="al-section">NBA</span> : null}
      </div>
      <div className="al-header-actions">
        {children}
        <div className="al-language" role="group" aria-label="Language / 语言">
          <button type="button" lang="en" aria-pressed={locale === "en"} onClick={() => onLocaleChange("en")}>EN</button>
          <button type="button" lang="zh-CN" aria-pressed={locale === "zh"} onClick={() => onLocaleChange("zh")}>中文</button>
        </div>
        <ThemeToggle locale={locale} />
      </div>
      <a className="al-website-link" href="https://aodongliu.github.io/">Aodong Liu<span aria-hidden="true">↗</span></a>
    </header>
  );
}
