import type { CalendarDay } from "@/lib/types";

const LEVELS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];

function level(count: number): string {
  if (count === 0) return LEVELS[0];
  if (count <= 2) return LEVELS[1];
  if (count <= 5) return LEVELS[2];
  if (count <= 9) return LEVELS[3];
  return LEVELS[4];
}

export function Heatmap({ calendar }: { calendar: CalendarDay[] }) {
  // 첫 날의 요일만큼 앞을 비워 주 단위 열로 배치
  const offset = calendar.length ? new Date(`${calendar[0].date}T00:00:00Z`).getUTCDay() : 0;
  const cells = [...Array<null>(offset).fill(null), ...calendar];
  const weeks = Math.ceil(cells.length / 7);
  const CELL = 10, GAP = 2;
  return (
    <svg
      viewBox={`0 0 ${weeks * (CELL + GAP)} ${7 * (CELL + GAP)}`}
      className="w-full"
      role="img"
      aria-label="contribution heatmap"
    >
      {cells.map((d, i) =>
        d === null ? null : (
          <rect
            key={d.date}
            x={Math.floor(i / 7) * (CELL + GAP)}
            y={(i % 7) * (CELL + GAP)}
            width={CELL}
            height={CELL}
            rx={2}
            fill={level(d.count)}
          />
        ),
      )}
    </svg>
  );
}
