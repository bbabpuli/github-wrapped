import type {
  CalendarDay, LanguageStat, RawContributions, RepoContribution, WrappedStats,
} from "@/lib/types";

const FALLBACK_COLOR = "#8b949e";

export function longestStreak(days: CalendarDay[]): number {
  let best = 0;
  let cur = 0;
  for (const d of days) {
    cur = d.count > 0 ? cur + 1 : 0;
    if (cur > best) best = cur;
  }
  return best;
}

export function hottestMonth(days: CalendarDay[]): number | null {
  const byMonth = new Array(12).fill(0) as number[];
  for (const d of days) byMonth[Number(d.date.slice(5, 7)) - 1] += d.count;
  const max = Math.max(...byMonth, 0);
  if (max === 0) return null;
  return byMonth.indexOf(max) + 1;
}

export function topWeekday(days: CalendarDay[]): number | null {
  const byDay = new Array(7).fill(0) as number[];
  for (const d of days) byDay[new Date(`${d.date}T00:00:00Z`).getUTCDay()] += d.count;
  const max = Math.max(...byDay, 0);
  if (max === 0) return null;
  return byDay.indexOf(max);
}

export function topLanguages(repos: RepoContribution[]): LanguageStat[] {
  const acc = new Map<string, { color: string | null; size: number }>();
  for (const r of repos)
    for (const l of r.languages) {
      const prev = acc.get(l.name);
      acc.set(l.name, { color: prev?.color ?? l.color, size: (prev?.size ?? 0) + l.size });
    }
  const total = [...acc.values()].reduce((s, v) => s + v.size, 0);
  if (total === 0) return [];
  return [...acc.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 5)
    .map(([name, v]) => ({
      name,
      color: v.color ?? FALLBACK_COLOR,
      percent: Math.round((v.size / total) * 100),
    }));
}

export function computeStats(raw: RawContributions, year: number): WrappedStats {
  return {
    login: raw.login,
    name: raw.name,
    avatarUrl: raw.avatarUrl,
    year,
    totals: {
      ...raw.totals,
      contributions: raw.calendar.reduce((s, d) => s + d.count, 0),
    },
    languages: topLanguages(raw.repos),
    longestStreak: longestStreak(raw.calendar),
    hottestMonth: hottestMonth(raw.calendar),
    topWeekday: topWeekday(raw.calendar),
    topRepos: [...raw.repos]
      .sort((a, b) => b.commitCount - a.commitCount)
      .slice(0, 5)
      .map((r) => ({ nameWithOwner: r.nameWithOwner, commitCount: r.commitCount })),
    calendar: raw.calendar,
  };
}
