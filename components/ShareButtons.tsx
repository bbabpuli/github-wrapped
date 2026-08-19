"use client";

import { t, type Lang } from "@/lib/i18n";

export function ShareButtons({
  login, year, tagline, lang,
}: { login: string; year: number; tagline: string; lang: Lang }) {
  const ogPath = `/api/og/${encodeURIComponent(login)}?lang=${lang}`;
  const share = () => {
    const url = `${window.location.origin}/${encodeURIComponent(login)}?lang=${lang}`;
    const text = `${login}'s ${year} GitHub Wrapped — ${tagline}`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      "_blank",
    );
  };
  return (
    <div className="flex flex-wrap gap-3">
      <a
        href={ogPath}
        download={`github-wrapped-${login}-${year}.png`}
        className="rounded-2xl bg-limepop px-6 py-4 font-display text-lg text-ink transition-transform hover:-rotate-1 hover:scale-105"
      >
        {t(lang, "saveImage")}
      </a>
      <button
        onClick={share}
        className="rounded-2xl bg-hotpink px-6 py-4 font-display text-lg text-ink transition-transform hover:rotate-1 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-limepop"
      >
        {t(lang, "shareX")}
      </button>
    </div>
  );
}
