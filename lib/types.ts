export interface CalendarDay {
  date: string; // "2026-03-14"
  count: number;
}

export interface RepoContribution {
  nameWithOwner: string;
  commitCount: number;
  languages: { name: string; color: string | null; size: number }[];
}

export interface RawContributions {
  login: string;
  name: string | null;
  avatarUrl: string;
  totals: { commits: number; prs: number; issues: number; reviews: number };
  calendar: CalendarDay[]; // 날짜 오름차순
  repos: RepoContribution[];
}

export interface LanguageStat {
  name: string;
  color: string;
  percent: number; // 0-100 정수
}

export interface WrappedStats {
  login: string;
  name: string | null;
  avatarUrl: string;
  year: number;
  totals: {
    commits: number;
    prs: number;
    issues: number;
    reviews: number;
    contributions: number; // calendar 합
  };
  languages: LanguageStat[]; // TOP 5
  longestStreak: number; // 연속 기여일 수
  hottestMonth: number | null; // 1-12, 기여 0이면 null
  topWeekday: number | null; // 0(일)~6(토), 기여 0이면 null
  topRepos: { nameWithOwner: string; commitCount: number }[]; // TOP 5
  calendar: CalendarDay[];
}
