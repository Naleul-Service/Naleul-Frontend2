import { NotEnough, Section } from '@/features/pattern/ui/Section'
import { dayOfMonth, formatDuration, monthOf } from '@/features/timetable/time'
import type { RecordPattern } from '../../api'
import { axisHours } from './format'

const W = 600
const H = 250
const PAD = { left: 40, right: 44, top: 28, bottom: 30 }

/**
 * 주차별로 쌓인 시간 (막대) + 처음부터의 누적 (선).
 * 막대는 주마다 오르내려도, 누적 선은 절대 내려가지 않아요 → "계속 쌓이고 있다"는 걸 보여주려고 같이 그렸어요.
 * SVG 로 직접 그려요 (차트 라이브러리를 추가하지 않으려고 — 나의 패턴 화면과 같은 방식).
 */
export function RecordWeeklyCard({ weeks }: { weeks: RecordPattern['rhythm']['weeks'] }) {
  const last = weeks[weeks.length - 1]
  if (!last || last.cumulativeMinutes === 0) {
    return (
      <Section title="주차별로 쌓인 시간" aside="최근 12주">
        <NotEnough>기록이 쌓이면 주마다 얼마나 했는지 보여드려요</NotEnough>
      </Section>
    )
  }

  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const slot = innerW / weeks.length
  const barW = Math.min(28, slot * 0.56)
  const maxWeek = Math.max(60, ...weeks.map((w) => w.minutes))
  const maxCum = Math.max(60, last.cumulativeMinutes)
  const cx = (i: number) => PAD.left + slot * i + slot / 2
  const yBar = (m: number) => PAD.top + innerH - (m / maxWeek) * innerH
  const yCum = (m: number) => PAD.top + innerH - (m / maxCum) * innerH
  const line = weeks.map((w, i) => `${i ? 'L' : 'M'}${cx(i)},${yCum(w.cumulativeMinutes)}`).join(' ')
  const lastIdx = weeks.length - 1

  // 최근 4주 평균 vs 그 전 4주 평균
  const avg = (list: typeof weeks) => list.reduce((n, w) => n + w.minutes, 0) / Math.max(list.length, 1)
  const recentAvg = Math.round(avg(weeks.slice(-4)))
  const prevAvg = Math.round(avg(weeks.slice(-8, -4)))

  return (
    <Section title="주차별로 쌓인 시간" aside={`누적 ${formatDuration(last.cumulativeMinutes)}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="주차별 쌓인 시간과 누적 그래프">
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={yBar(maxWeek * t)} y2={yBar(maxWeek * t)} stroke="#eceef1" />
            <text x={PAD.left - 8} y={yBar(maxWeek * t) + 4} textAnchor="end" fontSize="11" fill="#8b9099">
              {axisHours(maxWeek * t)}
            </text>
          </g>
        ))}

        {weeks.map((w, i) => {
          const h = Math.max(w.minutes ? 3 : 0, innerH - (yBar(w.minutes) - PAD.top))
          return (
            <rect
              key={w.weekStart}
              x={cx(i) - barW / 2}
              y={PAD.top + innerH - h}
              width={barW}
              height={h}
              rx="5"
              fill={i === lastIdx ? '#3d5afe' : '#c3cbfb'}
            >
              <title>{`${monthOf(w.weekStart)}/${dayOfMonth(w.weekStart)} 주 · ${formatDuration(w.minutes)} (${w.count}개)`}</title>
            </rect>
          )
        })}

        {/* 누적 선 */}
        <path d={line} fill="none" stroke="#111" strokeWidth="2" strokeLinejoin="round" strokeDasharray="0" />
        {weeks.map((w, i) => (
          <circle
            key={w.weekStart}
            cx={cx(i)}
            cy={yCum(w.cumulativeMinutes)}
            r={i === lastIdx ? 4.5 : 2.5}
            fill="#111"
            stroke="white"
            strokeWidth="1.5"
          />
        ))}
        <text x={cx(lastIdx) + 8} y={yCum(last.cumulativeMinutes) + 4} fontSize="11" fontWeight="700" fill="#111">
          {axisHours(last.cumulativeMinutes)}
        </text>

        {weeks.map((w, i) =>
          i % 2 === lastIdx % 2 ? (
            <text
              key={w.weekStart}
              x={cx(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize="11"
              fontWeight={i === lastIdx ? 700 : 400}
              fill={i === lastIdx ? '#111' : '#8b9099'}
            >
              {i === lastIdx ? '이번 주' : `${monthOf(w.weekStart)}/${dayOfMonth(w.weekStart)}`}
            </text>
          ) : null
        )}
      </svg>

      <div className="text-ink-3 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[3px] bg-[#c3cbfb]" /> 그 주에 쌓인 시간
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bg-ink h-0.5 w-4 rounded" /> 처음부터 누적
        </span>
      </div>

      {recentAvg > 0 && (
        <p className="bg-subtle text-ink-2 mt-4 rounded-2xl px-4 py-3 text-[14px] leading-relaxed">
          최근 4주는 한 주에 평균 <strong className="text-brand font-bold">{formatDuration(recentAvg)}</strong>
          {prevAvg > 0 && recentAvg > prevAvg ? (
            <>
              , 그 전 4주보다 <strong className="text-brand font-bold">{formatDuration(recentAvg - prevAvg)} 더</strong>{' '}
              하고 있어요
            </>
          ) : (
            ' 쌓고 있어요'
          )}
        </p>
      )}
    </Section>
  )
}
