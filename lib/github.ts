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
