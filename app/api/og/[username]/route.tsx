import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { fetchContributions, isValidGithubUsername } from "@/lib/github";
import { computeStats } from "@/lib/stats";
import { pickTagline } from "@/lib/phrases";
import { currentYear } from "@/lib/year";
import { monthName, parseLang } from "@/lib/i18n";

export const runtime = "nodejs"; // unstable_cache 공유 위해 페이지와 동일 런타임

const W = 1200;
const H = 630;
const OG_HEADERS = { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" };

const LIME = "#d2f65a";
const INK = "#121212";
const GRAPE = "#4100f4";

let fontPromise: Promise<Buffer> | null = null;
function loadDisplayFont() {
  fontPromise ??= readFile(
    path.join(process.cwd(), "assets/fonts/BlackHanSans-Regular.ttf"),
  );
  return fontPromise;
}

async function cardOptions() {
  // 폰트 로드 실패 시에도 카드 자체는 반환 (기본 폰트 폴백)
  try {
    const display = await loadDisplayFont();
    return {
      width: W,
      height: H,
      headers: OG_HEADERS,
      fonts: [{ name: "BlackHan", data: display, style: "normal" as const, weight: 400 as const }],
    };
  } catch {
    return { width: W, height: H, headers: OG_HEADERS };
  }
}

async function fallbackCard() {
  return new ImageResponse(
    (
      <div style={{
        width: W, height: H, display: "flex", alignItems: "center", justifyContent: "center",
        background: LIME, color: INK, fontSize: 72, fontFamily: "BlackHan",
      }}>
        🎁 GitHub Wrapped
      </div>
    ),
    await cardOptions(),
  );
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const { username: rawUsername } = await params;
    const lang = parseLang(new URL(req.url).searchParams.get("lang") ?? undefined);
    const year = currentYear();

    let username: string;
    try {
      username = decodeURIComponent(rawUsername);
    } catch {
      return await fallbackCard();
    }
    if (!isValidGithubUsername(username)) return await fallbackCard();

    const result = await fetchContributions(username, year);
    if (!result.ok) return await fallbackCard();

    const stats = computeStats(result.data, year);
    return await renderCard(stats, year, lang);
  } catch {
    return await fallbackCard();
  }
}

async function renderCard(
  stats: ReturnType<typeof computeStats>,
  year: number,
  lang: ReturnType<typeof parseLang>,
) {
  const tagline = pickTagline(stats, lang);
  const minis: [string, string][] = [
    ["Top language", stats.languages[0] ? `${stats.languages[0].name} ${stats.languages[0].percent}%` : "—"],
    ["Longest streak", `${stats.longestStreak} ${stats.longestStreak === 1 ? "day" : "days"}`],
    ["Hottest month", stats.hottestMonth ? monthName("en", stats.hottestMonth) : "—"],
  ];

  return new ImageResponse(
    (
      <div style={{
        width: W, height: H, display: "flex", flexDirection: "column",
        background: LIME, color: INK, padding: "48px 56px", fontFamily: "BlackHan",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={stats.avatarUrl} width={96} height={96}
               style={{ borderRadius: 999, border: `6px solid ${INK}` }} alt="" />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", fontSize: 52, lineHeight: 1 }}>
              {stats.login}&apos;s {year} WRAPPED
            </div>
            <div style={{
              display: "flex", alignSelf: "flex-start", background: INK, color: LIME,
              fontSize: 26, padding: "10px 22px", borderRadius: 999, transform: "rotate(-2deg)",
            }}>
              {tagline}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 48, marginTop: 36, flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 190, lineHeight: 0.9, color: GRAPE }}>
              {stats.totals.contributions.toLocaleString()}
            </div>
            <div style={{ display: "flex", fontSize: 30, marginTop: 10 }}>
              contributions
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 22, marginLeft: "auto", paddingBottom: 8 }}>
            {minis.map(([label, value]) => (
              <div key={label} style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: 20, opacity: 0.55, letterSpacing: 2 }}>
                  {label.toUpperCase()}
                </div>
                <div style={{ display: "flex", fontSize: 38, lineHeight: 1.1 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          display: "flex", justifyContent: "space-between", marginTop: 28,
          borderTop: `4px solid ${INK}`, paddingTop: 18, fontSize: 20,
        }}>
          <div style={{ display: "flex" }}>github-wrapped</div>
          <div style={{ display: "flex", opacity: 0.6 }}>
            {stats.totals.commits.toLocaleString()} {stats.totals.commits === 1 ? "commit" : "commits"} · Public activity only
          </div>
        </div>
      </div>
    ),
    await cardOptions(),
  );
}
