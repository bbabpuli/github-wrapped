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

function fallbackCard() {
  return new ImageResponse(
    (
      <div style={{
        width: W, height: H, display: "flex", alignItems: "center", justifyContent: "center",
        background: "#0d1117", color: "#fff", fontSize: 48, fontWeight: 700,
      }}>
        🎁 GitHub Wrapped
      </div>
    ),
    { width: W, height: H, headers: OG_HEADERS },
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
      return fallbackCard();
    }
    if (!isValidGithubUsername(username)) return fallbackCard();

    const result = await fetchContributions(username, year);
    if (!result.ok) return fallbackCard();

    const stats = computeStats(result.data, year);
    return renderCard(stats, year, lang);
  } catch {
    return fallbackCard();
  }
}

function renderCard(
  stats: ReturnType<typeof computeStats>,
  year: number,
  lang: ReturnType<typeof parseLang>,
) {
  const tagline = pickTagline(stats, lang);
  const nums: [string, number][] = [
    ["Commits", stats.totals.commits],
    ["PRs", stats.totals.prs],
    ["Issues", stats.totals.issues],
    ["Reviews", stats.totals.reviews],
  ];

  return new ImageResponse(
    (
      <div style={{
        width: W, height: H, display: "flex", flexDirection: "column",
        background: "linear-gradient(180deg, #0d1117 0%, #161b2e 100%)",
        color: "#fff", padding: 56, fontFamily: "sans-serif",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={stats.avatarUrl} width={88} height={88}
               style={{ borderRadius: 999, border: "4px solid #34d399" }} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 44, fontWeight: 800 }}>
              🎁 {stats.login}&apos;s {year} Wrapped
            </div>
            <div style={{ display: "flex", fontSize: 26, color: "#6ee7b7" }}>&ldquo;{tagline}&rdquo;</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 20, marginTop: 48 }}>
          {nums.map(([label, n]) => (
            <div key={label} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              background: "rgba(255,255,255,0.06)", borderRadius: 16, padding: "24px 36px", flex: 1,
            }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: "#34d399" }}>{n.toLocaleString()}</div>
              <div style={{ fontSize: 22, color: "#9ca3af" }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 20, marginTop: 24 }}>
          <div style={{
            display: "flex", flexDirection: "column",
            background: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 24, flex: 1,
          }}>
            <div style={{ fontSize: 20, color: "#9ca3af" }}>Top language</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 32, fontWeight: 700 }}>
              <div style={{
                width: 18, height: 18, borderRadius: 999,
                background: stats.languages[0]?.color ?? "#8b949e",
              }} />
              {stats.languages[0] ? `${stats.languages[0].name} ${stats.languages[0].percent}%` : "—"}
            </div>
          </div>
          <div style={{
            display: "flex", flexDirection: "column",
            background: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 24, flex: 1,
          }}>
            <div style={{ fontSize: 20, color: "#9ca3af" }}>Longest streak</div>
            <div style={{ display: "flex", fontSize: 32, fontWeight: 700 }}>🔥 {stats.longestStreak} days</div>
          </div>
          <div style={{
            display: "flex", flexDirection: "column",
            background: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 24, flex: 1,
          }}>
            <div style={{ fontSize: 20, color: "#9ca3af" }}>Hottest month</div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>
              {stats.hottestMonth ? monthName("en", stats.hottestMonth) : "—"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", marginTop: "auto", fontSize: 20, color: "#6b7280" }}>
          github-wrapped · {stats.totals.contributions.toLocaleString()} contributions in {year}
        </div>
      </div>
    ),
    { width: W, height: H, headers: OG_HEADERS },
  );
}
