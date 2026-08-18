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
    } | null;
    commitContributionsByRepository: {
      contributions: { totalCount: number };
      repository: {
        nameWithOwner: string;
        languages: { edges: { size: number; node: { name: string; color: string | null } }[] } | null;
      };
    }[] | null;
  } | null;
}

export type FetchResult =
  | { ok: true; data: RawContributions }
  | { ok: false; error: "not_found" | "rate_limited" | "api_error" };

/** rate_limited/api_error를 캐시하지 않기 위해 unstable_cache 콜백 안에서 throw하는 typed error. */
export class GhFetchError extends Error {
  constructor(public kind: "rate_limited" | "api_error") {
    super(`gh fetch failed: ${kind}`);
  }
}

/** GitHub 유저명 규칙: 영숫자로 시작, 하이픈 연속 불가, 최대 39자. */
export function isValidGithubUsername(v: string): boolean {
  return /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(v);
}

export function normalizeContributions(user: GhUser): RawContributions {
  const c = user.contributionsCollection ?? null;
  return {
    login: user.login,
    name: user.name,
    avatarUrl: user.avatarUrl,
    totals: {
      commits: c?.totalCommitContributions ?? 0,
      prs: c?.totalPullRequestContributions ?? 0,
      issues: c?.totalIssueContributions ?? 0,
      reviews: c?.totalPullRequestReviewContributions ?? 0,
    },
    calendar: (c?.contributionCalendar?.weeks ?? [])
      .flatMap((w) => w.contributionDays ?? [])
      .map((d) => ({ date: d.date, count: d.contributionCount }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    repos: (c?.commitContributionsByRepository ?? []).map((r) => ({
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

/**
 * GitHub GraphQL을 호출해 정규화된 데이터를 반환한다.
 * rate_limited/api_error는 unstable_cache가 캐시하지 않도록 throw한다 —
 * not_found와 성공(ok: true)만 이 함수의 반환값으로 캐시된다.
 */
async function fetchRaw(username: string, year: number): Promise<FetchResult> {
  let res: Response;
  try {
    res = await fetch("https://api.github.com/graphql", {
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
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new GhFetchError("api_error");
  }

  if (res.status === 403 || res.status === 429) throw new GhFetchError("rate_limited");
  if (!res.ok) throw new GhFetchError("api_error");

  let body: { data?: { user: GhUser | null }; errors?: { type?: string }[] };
  try {
    body = await res.json();
  } catch {
    throw new GhFetchError("api_error");
  }

  if (body.errors?.some((e) => e.type === "RATE_LIMITED")) throw new GhFetchError("rate_limited");
  if (!body.data?.user) return { ok: false, error: "not_found" };
  return { ok: true, data: normalizeContributions(body.data.user) };
}

export async function fetchContributions(username: string, year: number): Promise<FetchResult> {
  const cached = unstable_cache(
    () => fetchRaw(username, year),
    ["gh-contrib", username.toLowerCase(), String(year)],
    { revalidate: 3600 },
  );
  try {
    return await cached();
  } catch (e) {
    if (e instanceof GhFetchError) return { ok: false, error: e.kind };
    return { ok: false, error: "api_error" };
  }
}
