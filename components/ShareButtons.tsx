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
    <div className="flex gap-3">
      <a
        href={ogPath}
        download={`github-wrapped-${login}-${year}.png`}
        className="rounded-lg bg-white/10 px-5 py-3 font-bold hover:bg-white/20"
      >
        {t(lang, "saveImage")}
      </a>
      <button
        onClick={share}
        className="rounded-lg bg-emerald-500 px-5 py-3 font-bold text-black hover:bg-emerald-400"
      >
        {t(lang, "shareX")}
      </button>
    </div>
  );
}
