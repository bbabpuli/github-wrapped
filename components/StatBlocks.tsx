import type { WrappedStats } from "@/lib/types";
import { monthName, t, weekdayName, type Lang } from "@/lib/i18n";

function Section({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`w-full px-6 py-16 ${className}`}>
      <div className="mx-auto flex max-w-2xl flex-col gap-6">{children}</div>
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-sm font-semibold uppercase tracking-[0.2em] opacity-70">
      {children}
    </div>
  );
}

export function StatBlocks({ stats, lang }: { stats: WrappedStats; lang: Lang }) {
  const nums: [string, number][] = [
    [t(lang, "commits"), stats.totals.commits],
    [t(lang, "prs"), stats.totals.prs],
    [t(lang, "issues"), stats.totals.issues],
    [t(lang, "reviews"), stats.totals.reviews],
  ];
  const topLang = stats.languages[0];

  return (
    <>
      <Section className="bg-hotpink text-ink">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10">
          {nums.map(([label, n]) => (
            <div key={label}>
              <div className="font-display text-6xl leading-none sm:text-8xl">
                {n.toLocaleString()}
              </div>
              <div className="mt-2 text-lg font-semibold">{label}</div>
            </div>
          ))}
        </div>
      </Section>

      {topLang && (
        <Section className="bg-grape text-white">
          <Eyebrow>{t(lang, "topLanguages")}</Eyebrow>
          <div className="font-display text-6xl leading-none text-limepop sm:text-8xl">
            {topLang.name}
          </div>
          <div className="text-xl font-semibold">{topLang.percent}%</div>
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-white/20">
            {stats.languages.map((l) => (
              <div key={l.name} style={{ width: `${l.percent}%`, backgroundColor: l.color }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold">
            {stats.languages.map((l) => (
              <span key={l.name}>
                <span
                  className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: l.color }}
                />
                {l.name} {l.percent}%
              </span>
            ))}
          </div>
        </Section>
      )}

      <Section className="bg-tang text-ink">
        <div className="flex flex-col gap-10">
          <div>
            <Eyebrow>{t(lang, "longestStreak")}</Eyebrow>
            <div className="mt-1 font-display text-6xl leading-none sm:text-7xl">
              🔥 {stats.longestStreak}
              {lang === "ko" ? t(lang, "days") : ` ${t(lang, "days")}`}
            </div>
          </div>
          {stats.hottestMonth && (
            <div>
              <Eyebrow>{t(lang, "hottestMonth")}</Eyebrow>
              <div className="mt-1 font-display text-6xl leading-none sm:text-7xl">
                {monthName(lang, stats.hottestMonth)}
              </div>
            </div>
          )}
          {stats.topWeekday !== null && (
            <div>
              <Eyebrow>{t(lang, "topWeekday")}</Eyebrow>
              <div className="mt-1 font-display text-6xl leading-none sm:text-7xl">
                {weekdayName(lang, stats.topWeekday)}
              </div>
            </div>
          )}
        </div>
      </Section>

      {stats.topRepos.length > 0 && (
        <Section className="bg-limepop text-ink">
          <Eyebrow>{t(lang, "topRepos")}</Eyebrow>
          <ol className="flex flex-col">
            {stats.topRepos.map((r, i) => (
              <li
                key={r.nameWithOwner}
                className="flex items-baseline gap-4 border-b-[3px] border-ink py-4 last:border-b-0"
              >
                <span className="font-display text-5xl leading-none">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-lg font-semibold">
                  {r.nameWithOwner}
                </span>
                <span className="shrink-0 text-sm font-semibold opacity-60">
                  {r.commitCount.toLocaleString()} {t(lang, "commits").toLowerCase()}
                </span>
              </li>
            ))}
          </ol>
        </Section>
      )}
    </>
  );
}
