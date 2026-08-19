export type Lang = "ko" | "en";

const messages = {
  ko: {
    title: "GitHub Wrapped",
    subtitle: "올해 당신의 GitHub, 카드 한 장으로",
    placeholder: "GitHub 유저명 (예: honggildong)",
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
    placeholder: "GitHub username (e.g. honggildong)",
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
