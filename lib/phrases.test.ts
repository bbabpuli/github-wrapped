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
