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
