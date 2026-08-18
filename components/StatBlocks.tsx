import type { WrappedStats } from "@/lib/types";
import { monthName, t, weekdayName, type Lang } from "@/lib/i18n";

export function StatBlocks({ stats, lang }: { stats: WrappedStats; lang: Lang }) {
  const nums: [string, number][] = [
    [t(lang, "commits"), stats.totals.commits],
    [t(lang, "prs"), stats.totals.prs],
    [t(lang, "issues"), stats.totals.issues],
    [t(lang, "reviews"), stats.totals.reviews],
  ];
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {nums.map(([label, n]) => (
          <div key={label} className="rounded-xl bg-white/5 p-4 text-center">
            <div className="text-3xl font-extrabold text-emerald-400">{n.toLocaleString()}</div>
            <div className="mt-1 text-sm text-gray-400">{label}</div>
          </div>
        ))}
      </div>

      {stats.languages.length > 0 && (
        <div className="rounded-xl bg-white/5 p-4">
          <div className="mb-3 text-sm text-gray-400">{t(lang, "topLanguages")}</div>
          <div className="flex h-3 w-full overflow-hidden rounded-full">
            {stats.languages.map((l) => (
              <div key={l.name} style={{ width: `${l.percent}%`, backgroundColor: l.color }} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {stats.languages.map((l) => (
              <span key={l.name}>
                <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                {l.name} {l.percent}%
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-white/5 p-4">
          <div className="text-sm text-gray-400">{t(lang, "longestStreak")}</div>
          <div className="text-2xl font-bold">
            🔥 {stats.longestStreak}{lang === "ko" ? t(lang, "days") : ` ${t(lang, "days")}`}
          </div>
        </div>
        {stats.hottestMonth && (
          <div className="rounded-xl bg-white/5 p-4">
            <div className="text-sm text-gray-400">{t(lang, "hottestMonth")}</div>
            <div className="text-2xl font-bold">{monthName(lang, stats.hottestMonth)}</div>
          </div>
        )}
        {stats.topWeekday !== null && (
          <div className="rounded-xl bg-white/5 p-4">
            <div className="text-sm text-gray-400">{t(lang, "topWeekday")}</div>
            <div className="text-2xl font-bold">{weekdayName(lang, stats.topWeekday)}</div>
          </div>
        )}
      </div>

      {stats.topRepos.length > 0 && (
        <div className="rounded-xl bg-white/5 p-4">
          <div className="mb-2 text-sm text-gray-400">{t(lang, "topRepos")}</div>
          <ol className="space-y-1">
            {stats.topRepos.map((r, i) => (
              <li key={r.nameWithOwner} className="flex justify-between text-sm">
                <span>{i + 1}. {r.nameWithOwner}</span>
                <span className="text-gray-400">{r.commitCount} {t(lang, "commits").toLowerCase()}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
