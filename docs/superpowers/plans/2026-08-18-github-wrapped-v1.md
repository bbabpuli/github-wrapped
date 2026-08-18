# GitHub Wrapped v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GitHub 유저명을 입력하면 올해 활동을 분석해 공유용 카드(웹 페이지 + OG 이미지)로 렌더링하는 Next.js 웹 서비스 v1.

**Architecture:** 3개 유닛 — `lib/github.ts`(GraphQL 수집+1h 캐시) → `lib/stats.ts`(순수 계산) → `app/`(결과 페이지 + `/api/og` 카드 렌더). OG 메타가 카드 PNG를 가리켜 링크 공유 = 카드 공유.

**Tech Stack:** Next.js 15 (App Router) + TypeScript + Tailwind, `next/og`(ImageResponse, satori 내장 — 별도 패키지 불필요), vitest.

**Spec:** `docs/superpowers/specs/2026-08-18-github-wrapped-design.md`

## Global Constraints

- 레포: `bbabpuli/github-wrapped` (public). push 전 `gh auth status`로 활성 계정 `bbabpuli` 확인, 아니면 `gh auth switch --user bbabpuli`. 원격 URL엔 `bbabpuli@` 명시됨.
- `GITHUB_TOKEN`은 서버 전용 환경변수 — 클라이언트 번들에 절대 노출 금지 (`NEXT_PUBLIC_` 접두사 금지).
- `lib/stats.ts`·`lib/phrases.ts`는 순수 함수만 — `fetch`, `Date.now()`, `process.env` 접근 금지 (연도는 인자로 받음).
- 언어: 기본 한국어, `?lang=en` 쿼리로 영어. 하드코딩 문구 금지 — 전부 `lib/i18n.ts` 사전 경유.
- 커밋 메시지 끝: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- weknew 규칙(이슈 자동등록·worklog) 미적용. 이력 관리는 이 레포의 이슈 #1 + PR로.

---

### Task 0: 스캐폴드 + 이슈/브랜치

**Files:**
- Create: Next.js 스캐폴드 전체 (`package.json`, `app/`, `tsconfig.json` 등)
- Create: `vitest.config.ts`, `.env.local`, `.env.example`

**Interfaces:**
- Produces: `npm run dev`(3000 포트), `npm test`(vitest run), `@/` alias → 레포 루트

- [ ] **Step 1: GitHub 이슈 #1 생성 + 작업 브랜치**

```bash
cd ~/Documents/toy-project/github-wrapped
gh auth status 2>&1 | grep -q "account bbabpuli (keyring)" && gh auth switch --user bbabpuli
gh issue create --title "v1: 통계 카드 웹 서비스" --body "스펙: docs/superpowers/specs/2026-08-18-github-wrapped-design.md — 데이터 수집·통계·결과 페이지·OG 카드·i18n·Vercel 배포"
git checkout -b plan1-v1
```

- [ ] **Step 2: Next.js 스캐폴드 (기존 파일 보존 주의)**

create-next-app은 비어있지 않은 디렉터리를 거부하므로 임시 디렉터리에 생성 후 복사:

```bash
cd ~/Documents/toy-project
npx --yes create-next-app@latest gw-tmp --ts --tailwind --app --no-src-dir --import-alias "@/*" --eslint --no-turbopack --use-npm --skip-install
rsync -a --exclude .git gw-tmp/ github-wrapped/
rm -rf gw-tmp
cd github-wrapped && npm install
```

- [ ] **Step 3: vitest 설치·설정**

```bash
npm install -D vitest
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: { include: ["lib/**/*.test.ts"] },
});
```

`package.json`의 scripts에 추가: `"test": "vitest run"`

- [ ] **Step 4: 환경변수 파일**

Create `.env.example`:

```
# GitHub Personal Access Token (classic, scope 없음 — 공개 데이터만)
GITHUB_TOKEN=
# 선택: 설정 시 AI 한 줄 총평 활성화 (v2)
ANTHROPIC_API_KEY=
```

`.env.local`은 `.env.example` 복사 후 사용자의 PAT 입력 필요 — **체크포인트: 사용자에게 PAT 요청** (github.com/settings/tokens → classic, scope 전부 미체크). `.gitignore`에 `.env.local` 포함 확인 (create-next-app 기본값에 있음).

- [ ] **Step 5: 빌드·테스트 스모크 확인**

Run: `npm run build && npm test`
Expected: 빌드 성공, vitest "no test files found" 통과(exit 0이 아니면 `--passWithNoTests` 추가)

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: Next.js 15 + Tailwind + vitest 스캐폴드 (#1)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 1: 타입 + GraphQL 수집·정규화 (`lib/github.ts`)

**Files:**
- Create: `lib/types.ts`, `lib/github.ts`
- Create: `lib/fixtures/contributions.json`
- Test: `lib/github.test.ts`

**Interfaces:**
- Produces:
  - `RawContributions`, `WrappedStats` 타입 (`lib/types.ts`)
  - `normalizeContributions(user: GhUser): RawContributions` — 순수, 테스트 대상
  - `fetchContributions(username: string, year: number): Promise<FetchResult>` where `type FetchResult = { ok: true; data: RawContributions } | { ok: false; error: "not_found" | "rate_limited" | "api_error" }` — 1h 캐시

- [ ] **Step 1: 타입 정의**

Create `lib/types.ts`:

```ts
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
```

- [ ] **Step 2: GraphQL 응답 fixture 작성**

Create `lib/fixtures/contributions.json` (GraphQL `data.user` 형태 그대로):

```json
{
  "login": "bbabpuli",
  "name": "Dongeun",
  "avatarUrl": "https://avatars.githubusercontent.com/u/1?v=4",
  "contributionsCollection": {
    "totalCommitContributions": 300,
    "totalPullRequestContributions": 40,
    "totalIssueContributions": 15,
    "totalPullRequestReviewContributions": 8,
    "contributionCalendar": {
      "totalContributions": 363,
      "weeks": [
        { "contributionDays": [
          { "date": "2026-01-01", "contributionCount": 2 },
          { "date": "2026-01-02", "contributionCount": 0 },
          { "date": "2026-01-03", "contributionCount": 5 }
        ]},
        { "contributionDays": [
          { "date": "2026-01-04", "contributionCount": 1 },
          { "date": "2026-01-05", "contributionCount": 3 }
        ]}
      ]
    },
    "commitContributionsByRepository": [
      {
        "contributions": { "totalCount": 200 },
        "repository": {
          "nameWithOwner": "bbabpuli/pay-pos",
          "languages": { "edges": [
            { "size": 60000, "node": { "name": "Java", "color": "#b07219" } },
            { "size": 20000, "node": { "name": "HTML", "color": "#e34c26" } }
          ]}
        }
      },
      {
        "contributions": { "totalCount": 100 },
        "repository": {
          "nameWithOwner": "bbabpuli/tinyou",
          "languages": { "edges": [
            { "size": 40000, "node": { "name": "TypeScript", "color": "#3178c6" } }
          ]}
        }
      }
    ]
  }
}
```

- [ ] **Step 3: 정규화 실패 테스트 작성**

Create `lib/github.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizeContributions } from "@/lib/github";
import fixture from "@/lib/fixtures/contributions.json";

describe("normalizeContributions", () => {
  it("GraphQL user 응답을 RawContributions로 평탄화한다", () => {
    const raw = normalizeContributions(fixture as never);
    expect(raw.login).toBe("bbabpuli");
    expect(raw.totals).toEqual({ commits: 300, prs: 40, issues: 15, reviews: 8 });
    expect(raw.calendar).toHaveLength(5);
    expect(raw.calendar[0]).toEqual({ date: "2026-01-01", count: 2 });
    expect(raw.repos).toHaveLength(2);
    expect(raw.repos[0].nameWithOwner).toBe("bbabpuli/pay-pos");
    expect(raw.repos[0].commitCount).toBe(200);
    expect(raw.repos[0].languages[0]).toEqual({ name: "Java", color: "#b07219", size: 60000 });
  });

  it("languages/primaryLanguage가 비어도 안전하다", () => {
    const noLang = structuredClone(fixture) as never as typeof fixture;
    noLang.contributionsCollection.commitContributionsByRepository[0].repository.languages.edges = [];
    const raw = normalizeContributions(noLang as never);
    expect(raw.repos[0].languages).toEqual([]);
  });
});
```

- [ ] **Step 4: 실패 확인**

Run: `npm test`
Expected: FAIL — `normalizeContributions` export 없음

- [ ] **Step 5: 구현**

Create `lib/github.ts`:

```ts
import { unstable_cache } from "next/cache";
import type { RawContributions } from "@/lib/types";

// GraphQL 응답 형태 (필요 필드만)
export interface GhUser {
  login: string;
  name: string | null;
  avatarUrl: string;
  contributionsCollection: {
    totalCommitContributions: number;
    totalPullRequestContributions: number;
    totalIssueContributions: number;
    totalPullRequestReviewContributions: number;
    contributionCalendar: {
      weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
    };
    commitContributionsByRepository: {
      contributions: { totalCount: number };
      repository: {
        nameWithOwner: string;
        languages: { edges: { size: number; node: { name: string; color: string | null } }[] } | null;
      };
    }[];
  };
}

export type FetchResult =
  | { ok: true; data: RawContributions }
  | { ok: false; error: "not_found" | "rate_limited" | "api_error" };

export function normalizeContributions(user: GhUser): RawContributions {
  const c = user.contributionsCollection;
  return {
    login: user.login,
    name: user.name,
    avatarUrl: user.avatarUrl,
    totals: {
      commits: c.totalCommitContributions,
      prs: c.totalPullRequestContributions,
      issues: c.totalIssueContributions,
      reviews: c.totalPullRequestReviewContributions,
    },
    calendar: c.contributionCalendar.weeks
      .flatMap((w) => w.contributionDays)
      .map((d) => ({ date: d.date, count: d.contributionCount }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    repos: c.commitContributionsByRepository.map((r) => ({
      nameWithOwner: r.repository.nameWithOwner,
      commitCount: r.contributions.totalCount,
      languages: (r.repository.languages?.edges ?? []).map((e) => ({
        name: e.node.name,
        color: e.node.color,
        size: e.size,
      })),
    })),
  };
}

const QUERY = `
query ($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    login name avatarUrl
    contributionsCollection(from: $from, to: $to) {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalPullRequestReviewContributions
      contributionCalendar { weeks { contributionDays { date contributionCount } } }
      commitContributionsByRepository(maxRepositories: 25) {
        contributions { totalCount }
        repository {
          nameWithOwner
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            edges { size node { name color } }
          }
        }
      }
    }
  }
}`;

async function fetchRaw(username: string, year: number): Promise<FetchResult> {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: QUERY,
      variables: {
        login: username,
        from: `${year}-01-01T00:00:00Z`,
        to: `${year}-12-31T23:59:59Z`,
      },
    }),
    cache: "no-store", // 캐시는 unstable_cache가 담당
  });

  if (res.status === 403 || res.status === 429) return { ok: false, error: "rate_limited" };
  if (!res.ok) return { ok: false, error: "api_error" };

  const body = (await res.json()) as {
    data?: { user: GhUser | null };
    errors?: { type?: string }[];
  };
  if (body.errors?.some((e) => e.type === "RATE_LIMITED"))
    return { ok: false, error: "rate_limited" };
  if (!body.data?.user) return { ok: false, error: "not_found" };
  return { ok: true, data: normalizeContributions(body.data.user) };
}

export async function fetchContributions(username: string, year: number): Promise<FetchResult> {
  const cached = unstable_cache(
    () => fetchRaw(username, year),
    ["gh-contrib", username.toLowerCase(), String(year)],
    { revalidate: 3600 },
  );
  return cached();
}
```

- [ ] **Step 6: 통과 확인**

Run: `npm test`
Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```bash
git add lib/ && git commit -m "feat: GitHub GraphQL 수집·정규화 + 1h 캐시 (#1)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: 통계 계산 (`lib/stats.ts`)

**Files:**
- Create: `lib/stats.ts`
- Test: `lib/stats.test.ts`

**Interfaces:**
- Consumes: `RawContributions`, `CalendarDay`, `WrappedStats` (Task 1의 `lib/types.ts`)
- Produces:
  - `longestStreak(days: CalendarDay[]): number`
  - `hottestMonth(days: CalendarDay[]): number | null`
  - `topWeekday(days: CalendarDay[]): number | null`
  - `topLanguages(repos: RepoContribution[]): LanguageStat[]`
  - `computeStats(raw: RawContributions, year: number): WrappedStats`

- [ ] **Step 1: 실패 테스트 작성**

Create `lib/stats.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { longestStreak, hottestMonth, topWeekday, topLanguages, computeStats } from "@/lib/stats";
import type { CalendarDay, RawContributions } from "@/lib/types";

const day = (date: string, count: number): CalendarDay => ({ date, count });

describe("longestStreak", () => {
  it("연속 기여일 최대 길이를 센다", () => {
    expect(
      longestStreak([
        day("2026-01-01", 1), day("2026-01-02", 2), day("2026-01-03", 0),
        day("2026-01-04", 1), day("2026-01-05", 1), day("2026-01-06", 3),
      ]),
    ).toBe(3);
  });
  it("빈 배열·전부 0이면 0", () => {
    expect(longestStreak([])).toBe(0);
    expect(longestStreak([day("2026-01-01", 0)])).toBe(0);
  });
  it("끝까지 이어지는 streak도 잡는다", () => {
    expect(longestStreak([day("2026-01-01", 0), day("2026-01-02", 1), day("2026-01-03", 1)])).toBe(2);
  });
});

describe("hottestMonth", () => {
  it("기여 합이 최대인 월(1-12)을 반환, 동률은 이른 달", () => {
    expect(
      hottestMonth([day("2026-01-10", 5), day("2026-03-01", 3), day("2026-03-02", 2)]),
    ).toBe(1);
    expect(hottestMonth([day("2026-02-01", 4), day("2026-03-01", 4)])).toBe(2);
  });
  it("기여 0이면 null", () => {
    expect(hottestMonth([day("2026-01-01", 0)])).toBeNull();
  });
});

describe("topWeekday", () => {
  it("기여 합이 최대인 요일(0=일)을 반환", () => {
    // 2026-01-05는 월요일(1)
    expect(topWeekday([day("2026-01-05", 10), day("2026-01-06", 2)])).toBe(1);
  });
  it("기여 0이면 null", () => {
    expect(topWeekday([])).toBeNull();
  });
});

describe("topLanguages", () => {
  it("repo 간 바이트 합산으로 TOP 5, 정수 %", () => {
    const langs = topLanguages([
      { nameWithOwner: "a/x", commitCount: 1, languages: [
        { name: "TypeScript", color: "#3178c6", size: 600 },
        { name: "CSS", color: null, size: 100 },
      ]},
      { nameWithOwner: "a/y", commitCount: 1, languages: [
        { name: "TypeScript", color: "#3178c6", size: 200 },
        { name: "Go", color: "#00ADD8", size: 100 },
      ]},
    ]);
    expect(langs[0]).toEqual({ name: "TypeScript", color: "#3178c6", percent: 80 });
    expect(langs).toHaveLength(3);
    expect(langs.find((l) => l.name === "CSS")!.color).toBe("#8b949e"); // 색 폴백
  });
  it("언어 없으면 빈 배열", () => {
    expect(topLanguages([])).toEqual([]);
  });
});

describe("computeStats", () => {
  it("전체 통계를 조립한다", () => {
    const raw: RawContributions = {
      login: "bbabpuli", name: "Dongeun", avatarUrl: "https://x/a.png",
      totals: { commits: 10, prs: 2, issues: 1, reviews: 0 },
      calendar: [day("2026-01-01", 1), day("2026-01-02", 2)],
      repos: [{ nameWithOwner: "a/x", commitCount: 10, languages: [{ name: "Go", color: "#00ADD8", size: 100 }] }],
    };
    const s = computeStats(raw, 2026);
    expect(s.year).toBe(2026);
    expect(s.totals.contributions).toBe(3);
    expect(s.longestStreak).toBe(2);
    expect(s.topRepos).toEqual([{ nameWithOwner: "a/x", commitCount: 10 }]);
    expect(s.languages[0].name).toBe("Go");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL — `@/lib/stats` 모듈 없음

- [ ] **Step 3: 구현**

Create `lib/stats.ts`:

```ts
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
```

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: PASS (전체)

- [ ] **Step 5: Commit**

```bash
git add lib/ && git commit -m "feat: 통계 계산 순수 함수 (streak·언어·월·요일) (#1)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: i18n 사전 + 총평 문구 (`lib/i18n.ts`, `lib/phrases.ts`, `lib/tagline.ts`)

**Files:**
- Create: `lib/i18n.ts`, `lib/phrases.ts`, `lib/tagline.ts`
- Test: `lib/phrases.test.ts`

**Interfaces:**
- Consumes: `WrappedStats` (Task 1)
- Produces:
  - `type Lang = "ko" | "en"`, `parseLang(v: string | undefined): Lang`, `t(lang: Lang, key: MsgKey): string` (`lib/i18n.ts`)
  - `pickTagline(stats: WrappedStats, lang: Lang): string` — 순수 폴백 문구 (`lib/phrases.ts`)
  - `getTagline(stats: WrappedStats, lang: Lang): Promise<string>` — `ANTHROPIC_API_KEY` 있으면 Haiku, 실패·부재 시 `pickTagline` 폴백 (`lib/tagline.ts`)

- [ ] **Step 1: i18n 사전 작성**

Create `lib/i18n.ts`:

```ts
export type Lang = "ko" | "en";

const messages = {
  ko: {
    title: "GitHub Wrapped",
    subtitle: "올해 당신의 GitHub, 카드 한 장으로",
    placeholder: "GitHub 유저명 (예: bbabpuli)",
    analyze: "분석하기",
    commits: "커밋",
    prs: "PR",
    issues: "이슈",
    reviews: "리뷰",
    contributions: "총 기여",
    longestStreak: "최장 연속 기여",
    days: "일",
    hottestMonth: "가장 뜨거웠던 달",
    topLanguages: "언어 TOP 5",
    topRepos: "최다 기여 저장소",
    topWeekday: "가장 활발한 요일",
    saveImage: "이미지 저장",
    shareX: "X에 공유",
    notFoundTitle: "유저를 찾을 수 없어요",
    notFoundBody: "유저명을 다시 확인해 주세요.",
    rateLimitedTitle: "잠시 후 다시 시도해 주세요",
    rateLimitedBody: "GitHub API 호출 한도에 걸렸어요. 몇 분 뒤 새로고침하면 돼요.",
    apiErrorTitle: "일시적인 오류가 발생했어요",
    apiErrorBody: "잠시 후 다시 시도해 주세요.",
    backHome: "처음으로",
    weekdays: ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"],
    months: ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"],
  },
  en: {
    title: "GitHub Wrapped",
    subtitle: "Your year on GitHub, in one card",
    placeholder: "GitHub username (e.g. bbabpuli)",
    analyze: "Analyze",
    commits: "Commits",
    prs: "PRs",
    issues: "Issues",
    reviews: "Reviews",
    contributions: "Contributions",
    longestStreak: "Longest streak",
    days: "days",
    hottestMonth: "Hottest month",
    topLanguages: "Top 5 languages",
    topRepos: "Top repositories",
    topWeekday: "Most active day",
    saveImage: "Save image",
    shareX: "Share on X",
    notFoundTitle: "User not found",
    notFoundBody: "Please check the username and try again.",
    rateLimitedTitle: "Please try again soon",
    rateLimitedBody: "We hit the GitHub API rate limit. Refresh in a few minutes.",
    apiErrorTitle: "Something went wrong",
    apiErrorBody: "Please try again in a moment.",
    backHome: "Back to home",
    weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  },
} as const;

export type MsgKey = keyof (typeof messages)["ko"];

export function parseLang(v: string | undefined): Lang {
  return v === "en" ? "en" : "ko";
}

export function t(lang: Lang, key: Exclude<MsgKey, "weekdays" | "months">): string {
  return messages[lang][key];
}

export function weekdayName(lang: Lang, d: number): string {
  return messages[lang].weekdays[d];
}

export function monthName(lang: Lang, m: number): string {
  return messages[lang].months[m - 1];
}
```

- [ ] **Step 2: 총평 폴백 실패 테스트**

Create `lib/phrases.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pickTagline } from "@/lib/phrases";
import type { WrappedStats } from "@/lib/types";

const base: WrappedStats = {
  login: "u", name: null, avatarUrl: "", year: 2026,
  totals: { commits: 500, prs: 10, issues: 2, reviews: 1, contributions: 600 },
  languages: [{ name: "TypeScript", color: "#3178c6", percent: 62 }],
  longestStreak: 23, hottestMonth: 3, topWeekday: 2,
  topRepos: [], calendar: [],
};

describe("pickTagline", () => {
  it("언어+월이 있으면 장인 문구 (ko)", () => {
    expect(pickTagline(base, "ko")).toBe("3월에 불타올랐던 TypeScript 장인");
  });
  it("같은 입력 영어 문구", () => {
    expect(pickTagline(base, "en")).toBe("A TypeScript artisan who was on fire in Mar");
  });
  it("언어 없고 streak 있으면 streak 문구", () => {
    const s = { ...base, languages: [], hottestMonth: null };
    expect(pickTagline(s, "ko")).toBe("23일 연속 잔디를 심은 꾸준함의 아이콘");
  });
  it("아무 것도 없으면 기본 문구", () => {
    const s = { ...base, languages: [], hottestMonth: null, longestStreak: 0, totals: { ...base.totals, contributions: 0 } };
    expect(pickTagline(s, "ko")).toBe("내년의 잔디가 기대되는 개발자");
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npm test`
Expected: FAIL — `@/lib/phrases` 없음

- [ ] **Step 4: 구현**

Create `lib/phrases.ts` (순수 — env·fetch 금지):

```ts
import type { WrappedStats } from "@/lib/types";
import { monthName, type Lang } from "@/lib/i18n";

// 우선순위: 언어+월 > streak > 기여량 > 기본
export function pickTagline(stats: WrappedStats, lang: Lang): string {
  const lang1 = stats.languages[0]?.name;
  if (lang1 && stats.hottestMonth) {
    const m = monthName(lang, stats.hottestMonth);
    return lang === "ko"
      ? `${m}에 불타올랐던 ${lang1} 장인`
      : `A ${lang1} artisan who was on fire in ${m}`;
  }
  if (stats.longestStreak >= 7) {
    return lang === "ko"
      ? `${stats.longestStreak}일 연속 잔디를 심은 꾸준함의 아이콘`
      : `An icon of consistency with a ${stats.longestStreak}-day streak`;
  }
  if (stats.totals.contributions >= 100) {
    return lang === "ko"
      ? `올해 ${stats.totals.contributions}번 흔적을 남긴 개발자`
      : `A developer who left ${stats.totals.contributions} marks this year`;
  }
  return lang === "ko" ? "내년의 잔디가 기대되는 개발자" : "A developer whose next year looks promising";
}
```

Create `lib/tagline.ts` (env 접근은 여기만 — AI 슬롯, v2에서 키만 넣으면 활성화):

```ts
import type { WrappedStats } from "@/lib/types";
import type { Lang } from "@/lib/i18n";
import { pickTagline } from "@/lib/phrases";

export async function getTagline(stats: WrappedStats, lang: Lang): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return pickTagline(stats, lang);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 100,
        messages: [{
          role: "user",
          content:
            `GitHub 연간 활동 요약: 커밋 ${stats.totals.commits}, PR ${stats.totals.prs}, ` +
            `주력 언어 ${stats.languages[0]?.name ?? "없음"}, 최장 streak ${stats.longestStreak}일, ` +
            `가장 뜨거웠던 달 ${stats.hottestMonth ?? "없음"}월. ` +
            (lang === "ko"
              ? "이 개발자의 한 해를 위트있게 한 문장(25자 이내)으로 총평해줘. 문장만 출력."
              : "Write one witty sentence (max 60 chars) summarizing this developer's year. Output the sentence only."),
        }],
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return pickTagline(stats, lang);
    const body = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = body.content?.find((c) => c.type === "text")?.text?.trim();
    return text || pickTagline(stats, lang);
  } catch {
    return pickTagline(stats, lang);
  }
}
```

- [ ] **Step 5: 통과 확인**

Run: `npm test`
Expected: PASS (전체)

- [ ] **Step 6: Commit**

```bash
git add lib/ && git commit -m "feat: i18n 사전 + 총평 문구(템플릿 폴백/AI 슬롯) (#1)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: 홈 페이지 (유저명 입력)

**Files:**
- Modify: `app/page.tsx` (스캐폴드 기본 내용 전체 교체), `app/layout.tsx` (metadata만 교체)
- Delete: 스캐폴드 기본 에셋 중 미사용 svg (`public/next.svg`, `public/vercel.svg` 등)

**Interfaces:**
- Consumes: `parseLang`, `t` (Task 3)
- Produces: `/` — 폼 제출 시 GET `/{username}?lang={lang}` 이동

- [ ] **Step 1: layout metadata 교체**

`app/layout.tsx`의 `metadata`를 교체 (나머지 구조는 스캐폴드 유지):

```tsx
export const metadata: Metadata = {
  title: "GitHub Wrapped",
  description: "올해 당신의 GitHub, 카드 한 장으로",
};
```

- [ ] **Step 2: 홈 페이지 구현**

Replace `app/page.tsx`:

```tsx
import { parseLang, t } from "@/lib/i18n";
import { redirect } from "next/navigation";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const lang = parseLang((await searchParams).lang);

  async function go(formData: FormData) {
    "use server";
    const username = String(formData.get("username") ?? "").trim();
    const lang = String(formData.get("lang") ?? "ko");
    if (username) redirect(`/${encodeURIComponent(username)}?lang=${lang}`);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-b from-[#0d1117] to-[#161b2e] px-6 text-white">
      <div className="absolute right-6 top-6 text-sm text-gray-400">
        <a href="/?lang=ko" className={lang === "ko" ? "text-white font-bold" : ""}>한국어</a>
        {" · "}
        <a href="/?lang=en" className={lang === "en" ? "text-white font-bold" : ""}>English</a>
      </div>
      <h1 className="text-5xl font-extrabold tracking-tight">
        🎁 {t(lang, "title")}
      </h1>
      <p className="text-lg text-gray-400">{t(lang, "subtitle")}</p>
      <form action={go} className="flex w-full max-w-md gap-2">
        <input type="hidden" name="lang" value={lang} />
        <input
          name="username"
          required
          autoFocus
          placeholder={t(lang, "placeholder")}
          className="flex-1 rounded-lg border border-gray-700 bg-[#0d1117] px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-emerald-400"
        />
        <button
          type="submit"
          className="rounded-lg bg-emerald-500 px-5 py-3 font-bold text-black hover:bg-emerald-400"
        >
          {t(lang, "analyze")}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: 실기 확인**

Run: `npm run dev` 후 `curl -s http://localhost:3000 | grep -o "GitHub Wrapped" | head -1`
Expected: `GitHub Wrapped` 출력. 브라우저(또는 헤드리스)로 폼 제출 → `/bbabpuli?lang=ko` 이동 확인

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: 홈 페이지 — 유저명 입력 + 언어 토글 (#1)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: 결과 페이지 + 히트맵 + 공유 버튼

**Files:**
- Create: `app/[username]/page.tsx`, `components/Heatmap.tsx`, `components/StatBlocks.tsx`, `components/ShareButtons.tsx`, `lib/year.ts`

**Interfaces:**
- Consumes: `fetchContributions` (Task 1), `computeStats` (Task 2), `getTagline`·`t`·`parseLang`·`weekdayName`·`monthName` (Task 3)
- Produces:
  - `/{username}?lang=ko|en` — 통계 페이지. OG 메타 → `/api/og/{username}?lang=` (Task 6에서 구현되는 라우트를 미리 가리킴)
  - `currentYear(): number` (`lib/year.ts`) — `new Date()` 격리 지점
  - `<Heatmap calendar={CalendarDay[]} />` 서버 컴포넌트 (SVG)

- [ ] **Step 1: 연도 유틸**

Create `lib/year.ts`:

```ts
export function currentYear(): number {
  return new Date().getFullYear();
}
```

- [ ] **Step 2: 히트맵 컴포넌트 (SVG, 서버 렌더)**

Create `components/Heatmap.tsx`:

```tsx
import type { CalendarDay } from "@/lib/types";

const LEVELS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];

function level(count: number): string {
  if (count === 0) return LEVELS[0];
  if (count <= 2) return LEVELS[1];
  if (count <= 5) return LEVELS[2];
  if (count <= 9) return LEVELS[3];
  return LEVELS[4];
}

export function Heatmap({ calendar }: { calendar: CalendarDay[] }) {
  // 첫 날의 요일만큼 앞을 비워 주 단위 열로 배치
  const offset = calendar.length ? new Date(`${calendar[0].date}T00:00:00Z`).getUTCDay() : 0;
  const cells = [...Array<null>(offset).fill(null), ...calendar];
  const weeks = Math.ceil(cells.length / 7);
  const CELL = 10, GAP = 2;
  return (
    <svg
      viewBox={`0 0 ${weeks * (CELL + GAP)} ${7 * (CELL + GAP)}`}
      className="w-full"
      role="img"
      aria-label="contribution heatmap"
    >
      {cells.map((d, i) =>
        d === null ? null : (
          <rect
            key={d.date}
            x={Math.floor(i / 7) * (CELL + GAP)}
            y={(i % 7) * (CELL + GAP)}
            width={CELL}
            height={CELL}
            rx={2}
            fill={level(d.count)}
          />
        ),
      )}
    </svg>
  );
}
```

- [ ] **Step 3: 통계 블록 컴포넌트**

Create `components/StatBlocks.tsx`:

```tsx
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
          <div className="text-2xl font-bold">🔥 {stats.longestStreak}{lang === "ko" ? "일" : ` ${t(lang, "days")}`}</div>
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
```

- [ ] **Step 4: 공유 버튼 (클라이언트)**

Create `components/ShareButtons.tsx`:

```tsx
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
```

- [ ] **Step 5: 결과 페이지 (서버 컴포넌트, 에러 분기 포함)**

Create `app/[username]/page.tsx`:

```tsx
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
```

- [ ] **Step 6: 실기 확인 (실제 GitHub 데이터)**

`.env.local`에 `GITHUB_TOKEN` 설정 상태에서:

Run: `npm run dev` 후 `curl -s "http://localhost:3000/bbabpuli?lang=ko" | grep -c "Wrapped"`
Expected: 1 이상. 없는 유저 `curl -s "http://localhost:3000/no-such-user-xyz-999" | grep -o "유저를 찾을 수 없어요"` → 문구 출력

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: 결과 페이지 — 통계·히트맵·공유 버튼·에러 분기 (#1)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: OG 카드 이미지 (`/api/og/[username]`)

**Files:**
- Create: `app/api/og/[username]/route.tsx`

**Interfaces:**
- Consumes: `fetchContributions`, `computeStats`, `pickTagline`(OG는 빠른 렌더가 중요하므로 AI 아닌 폴백 직접 사용), `parseLang`, `monthName`, `currentYear`
- Produces: GET `/api/og/{username}?lang=ko|en` → 1200×630 PNG (Task 5의 OG 메타가 이 URL 사용)

- [ ] **Step 1: 구현**

Create `app/api/og/[username]/route.tsx`:

```tsx
import { ImageResponse } from "next/og";
import { fetchContributions } from "@/lib/github";
import { computeStats } from "@/lib/stats";
import { pickTagline } from "@/lib/phrases";
import { currentYear } from "@/lib/year";
import { monthName, parseLang } from "@/lib/i18n";

export const runtime = "nodejs"; // unstable_cache 공유 위해 페이지와 동일 런타임

const W = 1200;
const H = 630;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const lang = parseLang(new URL(req.url).searchParams.get("lang") ?? undefined);
  const year = currentYear();
  const result = await fetchContributions(decodeURIComponent(username), year);

  if (!result.ok) {
    return new ImageResponse(
      (
        <div style={{
          width: W, height: H, display: "flex", alignItems: "center", justifyContent: "center",
          background: "#0d1117", color: "#fff", fontSize: 48, fontWeight: 700,
        }}>
          🎁 GitHub Wrapped
        </div>
      ),
      { width: W, height: H },
    );
  }

  const stats = computeStats(result.data, year);
  const tagline = pickTagline(stats, lang);
  const nums: [string, number][] = [
    ["Commits", stats.totals.commits],
    ["PRs", stats.totals.prs],
    ["Issues", stats.totals.issues],
    ["Reviews", stats.totals.reviews],
  ];

  return new ImageResponse(
    (
      <div style={{
        width: W, height: H, display: "flex", flexDirection: "column",
        background: "linear-gradient(180deg, #0d1117 0%, #161b2e 100%)",
        color: "#fff", padding: 56, fontFamily: "sans-serif",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={stats.avatarUrl} width={88} height={88}
               style={{ borderRadius: 999, border: "4px solid #34d399" }} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 44, fontWeight: 800 }}>
              🎁 {stats.login}&apos;s {year} Wrapped
            </div>
            <div style={{ fontSize: 26, color: "#6ee7b7" }}>&ldquo;{tagline}&rdquo;</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 20, marginTop: 48 }}>
          {nums.map(([label, n]) => (
            <div key={label} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              background: "rgba(255,255,255,0.06)", borderRadius: 16, padding: "24px 36px", flex: 1,
            }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: "#34d399" }}>{n.toLocaleString()}</div>
              <div style={{ fontSize: 22, color: "#9ca3af" }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 20, marginTop: 24 }}>
          <div style={{
            display: "flex", flexDirection: "column",
            background: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 24, flex: 1,
          }}>
            <div style={{ fontSize: 20, color: "#9ca3af" }}>Top language</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 32, fontWeight: 700 }}>
              <div style={{
                width: 18, height: 18, borderRadius: 999,
                background: stats.languages[0]?.color ?? "#8b949e",
              }} />
              {stats.languages[0] ? `${stats.languages[0].name} ${stats.languages[0].percent}%` : "—"}
            </div>
          </div>
          <div style={{
            display: "flex", flexDirection: "column",
            background: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 24, flex: 1,
          }}>
            <div style={{ fontSize: 20, color: "#9ca3af" }}>Longest streak</div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>🔥 {stats.longestStreak} days</div>
          </div>
          <div style={{
            display: "flex", flexDirection: "column",
            background: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 24, flex: 1,
          }}>
            <div style={{ fontSize: 20, color: "#9ca3af" }}>Hottest month</div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>
              {stats.hottestMonth ? monthName("en", stats.hottestMonth) : "—"}
            </div>
          </div>
        </div>

        <div style={{ marginTop: "auto", fontSize: 20, color: "#6b7280" }}>
          github-wrapped · {stats.totals.contributions.toLocaleString()} contributions in {year}
        </div>
      </div>
    ),
    { width: W, height: H },
  );
}
```

주의: satori는 한글 폰트를 내장하지 않음 — OG 카드 텍스트는 **영어 고정**(위 코드가 이미 그렇게 작성됨. `tagline`만 lang을 따르는데, 한글 tagline이 □로 깨지면 이 라우트에서 `pickTagline(stats, "en")`으로 고정할 것. 실기 확인 시 판단).

- [ ] **Step 2: 실기 확인**

Run: `curl -s -o /tmp/og.png -w "%{http_code} %{content_type}" "http://localhost:3000/api/og/bbabpuli?lang=ko"`
Expected: `200 image/png`. `/tmp/og.png`를 Read 도구로 열어 카드 디자인·한글 깨짐 여부 눈으로 확인 (깨지면 위 주의사항 적용)

- [ ] **Step 3: 없는 유저 폴백 확인**

Run: `curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/og/no-such-user-xyz-999"`
Expected: `200` (기본 대체 카드)

- [ ] **Step 4: Commit**

```bash
git add app/api && git commit -m "feat: OG 카드 이미지 라우트 (1200x630, 폴백 카드 포함) (#1)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: README + 전체 검증 + PR

**Files:**
- Create: `README.md` (스캐폴드 기본 README 교체)

**Interfaces:**
- Consumes: 전체

- [ ] **Step 1: README 작성**

Replace `README.md`:

```markdown
# 🎁 GitHub Wrapped

올해 당신의 GitHub 활동을 카드 한 장으로 — 스포티파이 연말 결산의 개발자 버전.

유저명을 입력하면 커밋·PR·언어·잔디·streak을 분석해 공유용 카드를 만들어 줍니다.
링크를 X/카카오톡에 붙이면 카드 이미지가 미리보기로 뜹니다.

## 기능

- 연간 커밋 / PR / 이슈 / 리뷰 통계
- 언어 TOP 5 (repo별 바이트 합산)
- 잔디 히트맵, 최장 연속 기여 streak, 가장 뜨거웠던 달, 가장 활발한 요일
- 한 줄 총평 (템플릿 기반, `ANTHROPIC_API_KEY` 설정 시 AI 총평)
- 한국어 / English
- OG 카드 이미지 (`/api/og/{username}`) — 링크 공유 = 카드 공유

## 실행

```bash
cp .env.example .env.local   # GITHUB_TOKEN에 PAT 입력 (scope 불필요)
npm install
npm run dev                  # http://localhost:3000
npm test                     # vitest
```

## 스택

Next.js 15 (App Router) · TypeScript · Tailwind · next/og · vitest
```

- [ ] **Step 2: 전체 검증**

Run: `npm test && npm run build && npm run lint`
Expected: 전부 통과. 실패 시 고치고 재실행 — 통과 전 다음 단계 금지

- [ ] **Step 3: 실기 종합 확인**

`npm run dev` 상태에서:
- `/` 홈 렌더, 언어 토글
- `/bbabpuli` 실데이터 카드 (한/영)
- `/api/og/bbabpuli` PNG를 Read 도구로 눈 확인
- 없는 유저 → 안내 페이지

- [ ] **Step 4: PR 생성**

```bash
git add -A && git commit -m "docs: README (#1)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" || true
gh auth status 2>&1 | grep -q "Active account: true" # bbabpuli 확인
git push -u origin plan1-v1
gh pr create --title "v1: 통계 카드 웹 서비스" --body "Closes #1

스펙: docs/superpowers/specs/2026-08-18-github-wrapped-design.md
플랜: docs/superpowers/plans/2026-08-18-github-wrapped-v1.md

- GitHub GraphQL 수집 + 1h 캐시
- 통계 순수 함수 (vitest)
- 결과 페이지 + 히트맵 + 공유
- OG 카드 (1200x630)
- 한/영 i18n, AI 총평 슬롯(폴백)

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

### Task 8: Vercel 배포 (사용자 개입 필요 — 체크포인트)

**Files:** 없음 (설정만)

**Interfaces:**
- Consumes: main 머지된 전체 앱

- [ ] **Step 1: 사용자 체크포인트 — Vercel 계정 연결**

Vercel 계정이 없거나 CLI 미로그인이면 사용자에게 요청: `! npx vercel login` (GitHub 로그인 — **bbabpuli 계정으로**).

- [ ] **Step 2: 프로젝트 연결 + 환경변수**

```bash
cd ~/Documents/toy-project/github-wrapped
npx vercel link --yes
npx vercel env add GITHUB_TOKEN production   # 프롬프트에 PAT 붙여넣기 (사용자)
```

- [ ] **Step 3: 프로덕션 배포**

```bash
npx vercel --prod
```

Expected: `https://github-wrapped-*.vercel.app` URL 출력

- [ ] **Step 4: 배포 검증**

Run: `curl -s -o /dev/null -w "%{http_code}" "https://<배포URL>/bbabpuli"` → `200`
`curl -s -o /dev/null -w "%{http_code} %{content_type}" "https://<배포URL>/api/og/bbabpuli"` → `200 image/png`
X Card Validator 또는 실제 X 글 작성창에 링크 붙여 카드 미리보기 확인 (사용자).

- [ ] **Step 5: 레포 마무리**

```bash
gh repo edit bbabpuli/github-wrapped --homepage "https://<배포URL>" --add-topic nextjs --add-topic github-wrapped
```

이슈 #1은 PR 머지로 자동 클로즈 확인.

---

## Self-Review 결과

- **스펙 커버리지**: §3.1→Task 1, §3.2→Task 2, §3.3→Task 4·5·6, 총평·i18n→Task 3, 에러 처리(§5)→Task 1(FetchResult)+Task 5(ErrorScreen)+Task 6(폴백 카드), 테스트(§6)→각 Task TDD+실기, 배포→Task 8. 갭 없음.
- **플레이스홀더**: 없음 — 전 코드 블록 실코드.
- **타입 일관성**: `FetchResult`·`WrappedStats`·`Lang`·`CalendarDay` 시그니처가 Task 간 동일함 확인. `pickTagline(stats, lang)` / `getTagline(stats, lang)` 구분 일관.
- **알려진 리스크**: ① satori 한글 폰트 미내장 → Task 6에 판단 기준 명시 ② `unstable_cache` 직렬화 한계 → 반환값이 plain object라 안전 ③ create-next-app 버전에 따른 플래그 차이 → 실패 시 대화형으로 동일 선택.
