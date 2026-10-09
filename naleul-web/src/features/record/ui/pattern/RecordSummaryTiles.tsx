import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { formatDuration } from '@/features/timetable/time'
import type { RecordPattern } from '../../api'

function Tile({ label, value, sub, up }: { label: string; value: ReactNode; sub: ReactNode; up?: boolean }) {
  return (
    <Card className="flex min-h-[132px] flex-col justify-between p-5">
      <p className="text-ink-3 text-[13px]">{label}</p>
      <div>
        <p className="text-[28px] leading-none font-extrabold tracking-tight">{value}</p>
        <p className={cn('mt-2 text-[13px] font-semibold', up ? 'text-success' : 'text-ink-3')}>{sub}</p>
      </div>
    </Card>
  )
}

/**
 * 요약 4칸. 기한·목표 수치가 없으니 "쌓인 양"과 "그 전 4주보다 늘어난 것"만 보여줘요.
 * 줄었을 때는 빨간색 대신 그냥 최근 값을 보여줘요 (기록형은 쉬어가는 주도 자연스러워요).
 */
export function RecordSummaryTiles({ summary: s }: { summary: RecordPattern['summary'] }) {
  const r = s.recent
  const p = s.previous

  const moreMinutes = p.minutes > 0 && r.minutes > p.minutes ? r.minutes - p.minutes : 0
  const moreDays = p.activeDays > 0 && r.activeDays > p.activeDays ? r.activeDays - p.activeDays : 0
  const session = r.avgSessionMinutes ?? (s.totalRecords ? Math.round(s.totalMinutes / s.totalRecords) : null)
  const longer =
    r.avgSessionMinutes != null && p.avgSessionMinutes != null && r.avgSessionMinutes - p.avgSessionMinutes >= 5
      ? r.avgSessionMinutes - p.avgSessionMinutes
      : 0

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <Tile
        label="쌓인 시간"
        value={s.totalMinutes ? formatDuration(s.totalMinutes) : '0분'}
        sub={moreMinutes ? `▲ 최근 4주 ${formatDuration(moreMinutes)} 더` : `최근 4주 ${formatDuration(r.minutes)}`}
        up={!!moreMinutes}
      />
      <Tile
        label="기록한 날"
        value={`${s.activeDays}일`}
        sub={moreDays ? `▲ 최근 4주 ${r.activeDays}일 · ${moreDays}일 더` : `최근 4주 ${r.activeDays}일`}
        up={!!moreDays}
      />
      <Tile
        label="한 번에 집중"
        value={session != null ? formatDuration(session) : '–'}
        sub={longer ? `▲ 그 전 4주보다 ${formatDuration(longer)} 길어졌어요` : `기록 ${s.totalRecords}개의 평균`}
        up={!!longer}
      />
      <Tile
        label="연속 기록"
        value={
          <>
            {s.weekStreak > 0 && <span aria-hidden>🔥 </span>}
            {s.weekStreak}주
          </>
        }
        sub={
          s.thisWeekRecorded
            ? '이번 주도 기록했어요'
            : s.weekStreak > 0
              ? `이번 주에 남기면 ${s.weekStreak + 1}주째예요`
              : '이번 주에 첫 칸을 채워보세요'
        }
        up={s.thisWeekRecorded && s.weekStreak >= 2}
      />
    </div>
  )
}
