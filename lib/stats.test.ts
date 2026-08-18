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
