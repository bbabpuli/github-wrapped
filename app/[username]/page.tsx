import type { Metadata } from "next";
import { fetchContributions } from "@/lib/github";
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

function ErrorScreen({ lang, titleKey, bodyKey }: {
  lang: Lang;
  titleKey: "notFoundTitle" | "rateLimitedTitle" | "apiErrorTitle";
  bodyKey: "notFoundBody" | "rateLimitedBody" | "apiErrorBody";
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0d1117] px-6 text-white">
      <h1 className="text-3xl font-bold">{t(lang, titleKey)}</h1>
      <p className="text-gray-400">{t(lang, bodyKey)}</p>
      <a href={`/?lang=${lang}`} className="mt-4 rounded-lg bg-emerald-500 px-5 py-3 font-bold text-black">
        {t(lang, "backHome")}
      </a>
    </main>
  );
}

export default async function WrappedPage({ params, searchParams }: Props) {
  const { username } = await params;
  const lang = parseLang((await searchParams).lang);
  const year = currentYear();

  const result = await fetchContributions(decodeURIComponent(username), year);
  if (!result.ok) {
    if (result.error === "not_found")
      return <ErrorScreen lang={lang} titleKey="notFoundTitle" bodyKey="notFoundBody" />;
    if (result.error === "rate_limited")
      return <ErrorScreen lang={lang} titleKey="rateLimitedTitle" bodyKey="rateLimitedBody" />;
    return <ErrorScreen lang={lang} titleKey="apiErrorTitle" bodyKey="apiErrorBody" />;
  }

  const stats = computeStats(result.data, year);
  const tagline = await getTagline(stats, lang);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0d1117] to-[#161b2e] px-6 py-12 text-white">
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <header className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={stats.avatarUrl} alt="" className="h-16 w-16 rounded-full border-2 border-emerald-400" />
          <div>
            <h1 className="text-2xl font-extrabold">
              🎁 {stats.name ?? stats.login}&apos;s {year} Wrapped
            </h1>
            <p className="text-emerald-300">&ldquo;{tagline}&rdquo;</p>
          </div>
        </header>

        <div className="rounded-xl bg-white/5 p-4">
          <div className="mb-2 text-sm text-gray-400">
            {t(lang, "contributions")}: {stats.totals.contributions.toLocaleString()}
          </div>
          <Heatmap calendar={stats.calendar} />
        </div>

        <StatBlocks stats={stats} lang={lang} />
        <ShareButtons login={stats.login} year={year} tagline={tagline} lang={lang} />
      </div>
    </main>
  );
}
