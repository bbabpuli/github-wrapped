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
