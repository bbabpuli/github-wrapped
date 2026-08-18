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
