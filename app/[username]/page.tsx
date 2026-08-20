import type { Metadata } from "next";
import Link from "next/link";
import { fetchContributions, isValidGithubUsername } from "@/lib/github";
import { computeStats } from "@/lib/stats";
import { getTagline } from "@/lib/tagline";
import { currentYear } from "@/lib/year";
import { parseLang, t, type Lang } from "@/lib/i18n";
import { Heatmap } from "@/components/Heatmap";
import { StatBlocks } from "@/components/StatBlocks";
import { ShareButtons } from "@/components/ShareButtons";

type Props = {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ lang?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { username } = await params;
  const lang = parseLang((await searchParams).lang);
  const title = `${username}'s ${currentYear()} GitHub Wrapped`;
  const ogImage = `/api/og/${encodeURIComponent(username)}?lang=${lang}`;
  return {
    title,
    openGraph: { title, images: [{ url: ogImage, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, images: [ogImage] },
  };
}

function LangToggle({ username, lang }: { username: string; lang: Lang }) {
  return (
    <div className="absolute right-6 top-6 z-10 text-sm font-semibold text-ink">
      <Link
        href={`/${encodeURIComponent(username)}?lang=ko`}
        className={lang === "ko" ? "underline underline-offset-4" : "opacity-50"}
      >
        한국어
      </Link>
      {" · "}
      <Link
        href={`/${encodeURIComponent(username)}?lang=en`}
        className={lang === "en" ? "underline underline-offset-4" : "opacity-50"}
      >
        English
      </Link>
    </div>
  );
}

function ErrorScreen({ username, lang, titleKey, bodyKey }: {
  username: string;
  lang: Lang;
  titleKey: "notFoundTitle" | "rateLimitedTitle" | "apiErrorTitle";
  bodyKey: "notFoundBody" | "rateLimitedBody" | "apiErrorBody";
}) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-4 bg-limepop px-6 text-center text-ink">
      <LangToggle username={username} lang={lang} />
      <h1 className="font-display text-4xl sm:text-5xl">{t(lang, titleKey)}</h1>
      <p className="font-semibold">{t(lang, bodyKey)}</p>
      <a
        href={`/?lang=${lang}`}
        className="mt-4 rounded-2xl bg-grape px-7 py-4 font-display text-lg text-white transition-transform hover:-rotate-1 hover:scale-105"
      >
        {t(lang, "backHome")}
      </a>
    </main>
  );
}

export default async function WrappedPage({ params, searchParams }: Props) {
  const { username: rawUsername } = await params;
  const lang = parseLang((await searchParams).lang);
  const year = currentYear();

  let username: string;
  try {
    username = decodeURIComponent(rawUsername);
  } catch {
    return <ErrorScreen username={rawUsername} lang={lang} titleKey="notFoundTitle" bodyKey="notFoundBody" />;
  }

  if (!isValidGithubUsername(username))
    return <ErrorScreen username={username} lang={lang} titleKey="notFoundTitle" bodyKey="notFoundBody" />;

  const result = await fetchContributions(username, year);
  if (!result.ok) {
    if (result.error === "not_found")
      return <ErrorScreen username={username} lang={lang} titleKey="notFoundTitle" bodyKey="notFoundBody" />;
    if (result.error === "rate_limited")
      return <ErrorScreen username={username} lang={lang} titleKey="rateLimitedTitle" bodyKey="rateLimitedBody" />;
    return <ErrorScreen username={username} lang={lang} titleKey="apiErrorTitle" bodyKey="apiErrorBody" />;
  }

  const stats = computeStats(result.data, year);
  const tagline = await getTagline(stats, lang);

  return (
    <main className="relative min-h-screen bg-limepop text-ink">
      <LangToggle username={username} lang={lang} />

      <section className="w-full px-6 pb-16 pt-24">
        <div className="mx-auto flex max-w-2xl flex-col items-start gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={stats.avatarUrl}
            alt=""
            className="h-24 w-24 rounded-full border-4 border-ink"
          />
          <h1 className="font-display text-5xl leading-[0.95] sm:text-7xl">
            {stats.name ?? stats.login}
            <span className="block">{year} Wrapped</span>
          </h1>
          <p className="-rotate-2 rounded-full bg-ink px-5 py-2.5 font-display text-lg text-limepop">
            {tagline}
          </p>
          <p className="text-xs font-semibold opacity-60">
            @{stats.login} · {t(lang, "publicOnly")}
          </p>
        </div>
      </section>

      <section className="w-full bg-ink px-6 py-16 text-white">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] opacity-70">
            {t(lang, "contributions")}
          </div>
          <div className="font-display text-7xl leading-none text-limepop sm:text-9xl">
            {stats.totals.contributions.toLocaleString()}
          </div>
          <Heatmap calendar={stats.calendar} />
        </div>
      </section>

      <StatBlocks stats={stats} lang={lang} />

      <section className="w-full bg-ink px-6 py-16 text-white">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <Link
            href={`/?lang=${lang}`}
            className="block rounded-2xl bg-grape px-6 py-6 text-center font-display text-2xl text-white transition-transform hover:-rotate-1 hover:scale-[1.02] sm:text-3xl"
          >
            {t(lang, "makeMine")}
          </Link>
          <ShareButtons login={stats.login} year={year} tagline={tagline} lang={lang} />
          <p className="text-xs font-semibold opacity-50">
            github-wrapped · {t(lang, "publicOnly")}
          </p>
        </div>
      </section>
    </main>
  );
}
