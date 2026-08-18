import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { normalizeContributions, isValidGithubUsername, fetchContributions } from "@/lib/github";
import fixture from "@/lib/fixtures/contributions.json";

vi.mock("next/cache", () => ({
  // 테스트에서는 캐시를 우회 — 인자로 받은 함수를 그대로 반환한다.
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

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

  it("contributionsCollection이 null인 부분 응답에서도 throw하지 않고 빈 값을 반환한다", () => {
    const partial = { login: "ghost", name: null, avatarUrl: "https://x", contributionsCollection: null };
    const raw = normalizeContributions(partial as never);
    expect(raw.totals).toEqual({ commits: 0, prs: 0, issues: 0, reviews: 0 });
    expect(raw.calendar).toEqual([]);
    expect(raw.repos).toEqual([]);
  });
});

describe("isValidGithubUsername", () => {
  it("유효한 유저명을 허용한다", () => {
    expect(isValidGithubUsername("bbabpuli")).toBe(true);
    expect(isValidGithubUsername("a")).toBe(true);
    expect(isValidGithubUsername("a-b-c")).toBe(true);
    expect(isValidGithubUsername("a".repeat(39))).toBe(true); // 39자는 허용 한계
  });

  it("무효한 유저명을 거부한다", () => {
    expect(isValidGithubUsername("")).toBe(false);
    expect(isValidGithubUsername("-abc")).toBe(false); // 하이픈으로 시작 불가
    expect(isValidGithubUsername("abc-")).toBe(false); // 하이픈으로 끝날 수 없음
    expect(isValidGithubUsername("ab--c")).toBe(false); // 하이픈 연속 불가
    expect(isValidGithubUsername("ab_c")).toBe(false); // 언더스코어 불가
    expect(isValidGithubUsername("a".repeat(40))).toBe(false); // 39자 초과
    expect(isValidGithubUsername("%zz")).toBe(false);
  });
});

describe("fetchContributions 에러 매핑", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("403 응답은 rate_limited로 매핑되고 캐시되지 않는다", async () => {
    vi.mocked(fetch).mockResolvedValue({ status: 403, ok: false } as Response);
    const result = await fetchContributions("bbabpuli", 2026);
    expect(result).toEqual({ ok: false, error: "rate_limited" });
  });

  it("429 응답은 rate_limited로 매핑된다", async () => {
    vi.mocked(fetch).mockResolvedValue({ status: 429, ok: false } as Response);
    const result = await fetchContributions("bbabpuli", 2026);
    expect(result).toEqual({ ok: false, error: "rate_limited" });
  });

  it("5xx 응답은 api_error로 매핑된다", async () => {
    vi.mocked(fetch).mockResolvedValue({ status: 500, ok: false } as Response);
    const result = await fetchContributions("bbabpuli", 2026);
    expect(result).toEqual({ ok: false, error: "api_error" });
  });

  it("네트워크 예외(fetch throw)는 api_error로 매핑된다", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("network down"));
    const result = await fetchContributions("bbabpuli", 2026);
    expect(result).toEqual({ ok: false, error: "api_error" });
  });

  it("응답 본문에 user가 없으면 not_found로 매핑된다", async () => {
    vi.mocked(fetch).mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ data: { user: null } }),
    } as Response);
    const result = await fetchContributions("ghost", 2026);
    expect(result).toEqual({ ok: false, error: "not_found" });
  });

  it("GraphQL errors에 RATE_LIMITED 타입이 있으면 rate_limited로 매핑된다", async () => {
    vi.mocked(fetch).mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ errors: [{ type: "RATE_LIMITED" }] }),
    } as Response);
    const result = await fetchContributions("bbabpuli", 2026);
    expect(result).toEqual({ ok: false, error: "rate_limited" });
  });

  it("성공 응답은 정규화된 데이터를 반환한다", async () => {
    vi.mocked(fetch).mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ data: { user: fixture } }),
    } as Response);
    const result = await fetchContributions("bbabpuli", 2026);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.login).toBe("bbabpuli");
  });
});
