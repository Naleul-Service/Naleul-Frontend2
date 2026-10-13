'use client'

import { useMemo } from 'react'
import { Flame } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { addDays, addMonths, weekdayIndex, WEEKDAY_LABEL } from '@/features/timetable/time'
import { Section } from '@/features/goal/ui/sections'
import { useHabitHeatmap, type Habit, type HabitDayState } from '../api'

/** 칸 크기 · 간격 (px) */
const CELL = 14
const GAP = 3
/** 서버가 한 번에 주는 최대 기간(400일) 안에서 — 최근 12달 + 이번 달 */
const MAX_MONTHS_BACK = 12

const STATE_CLASS: Record<HabitDayState, string> = {
  DONE: 'bg-brand',
  MISSED: 'bg-line-strong',
  TODO: 'bg-surface ring-brand ring-[1.5px] ring-inset',
  OFF: 'bg-subtle',
  PAUSED: 'bg-hatch ring-hatch-line ring-1 ring-inset',
  BEFORE_START: 'bg-transparent',
  FUTURE: 'bg-transparent ring-line ring-1 ring-inset',
}

const STATE_LABEL: Record<HabitDayState, string> = {
  DONE: '했어요',
  MISSED: '놓쳤어요',
  TODO: '오늘 아직',
  OFF: '안 하는 날',
  PAUSED: '쉬는 중',
  BEFORE_START: '시작 전',
  FUTURE: '',
}

const firstOfMonth = (ymd: string) => `${ymd.slice(0, 8)}01`
const lastOfMonth = (ymd: string) => addDays(addMonths(firstOfMonth(ymd), 1), -1)

/** start 달부터 end 달까지 매달 1일 */
function monthsBetween(start: string, end: string) {
  const out: string[] = []
  for (let m = firstOfMonth(start); m <= end; m = addMonths(m, 1)) out.push(m)
  return out
}

/**
 * 습관별 잔디 — 습관을 추가한 달부터 한 달에 한 장씩 달력처럼 쌓여요.
 * (전체를 합친 잔디는 없앴어요: 습관마다 시작한 날이 달라서 합치면 "언제부터 했는지"가 안 보여요)
 */
export function HabitHeatmap({ habits, today }: { habits: Habit[]; today: string }) {
  const shown = useMemo(
    () =>
      habits
        .filter((h) => h.status !== 'DELETED')
        .sort((a, b) => Number(a.status === 'PAUSED') - Number(b.status === 'PAUSED')),
    [habits]
  )
  // 가장 먼저 시작한 습관의 그 달 1일부터 (최근 12달까지)
  const limit = addMonths(firstOfMonth(today), -MAX_MONTHS_BACK)
  const earliest = shown.reduce((m, h) => (h.startDate < m ? h.startDate : m), today)
  const from = firstOfMonth(earliest) < limit ? limit : firstOfMonth(earliest)
  const { data, isPending } = useHabitHeatmap(from, shown.length > 0)

  const stateOf = useMemo(() => {
    const map = new Map<number, Map<string, HabitDayState>>()
    for (const row of data?.habits ?? []) {
      const m = new Map<string, HabitDayState>()
      row.cells.forEach((s, i) => m.set(addDays(data!.from, i), s))
      map.set(row.habitId, m)
    }
    return map
  }, [data])

  if (shown.length === 0) return null

  return (
    <Section title="습관별 잔디" aside="추가한 달부터 한 달씩">
      {isPending ? (
        <div className="grid h-32 place-items-center">
          <Spinner className="text-ink-3 size-5" />
        </div>
      ) : (
        <ul className="divide-line -my-2 divide-y">
          {shown.map((h) => (
            <HabitMonths key={h.habitId} habit={h} today={today} from={from} states={stateOf.get(h.habitId)} />
          ))}
        </ul>
      )}
      <p className="text-ink-3 mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <Legend className="bg-brand">했어요</Legend>
        <Legend className="bg-line-strong">놓쳤어요</Legend>
        <Legend className="bg-subtle">안 하는 날</Legend>
        <Legend className="bg-hatch ring-hatch-line ring-1 ring-inset">쉬는 중</Legend>
      </p>
    </Section>
  )
}

function HabitMonths({
  habit: h,
  today,
  from,
  states,
}: {
  habit: Habit
  today: string
  from: string
  states: Map<string, HabitDayState> | undefined
}) {
  const start = h.startDate > from ? h.startDate : from
  const months = monthsBetween(start, today)

  return (
    <li className={cn('py-4', h.status === 'PAUSED' && 'opacity-60')}>
      <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2 text-[14px]">
        <span className="font-bold">
          {h.emoji ? `${h.emoji} ` : ''}
          {h.name}
        </span>
        <span className="text-ink-3 text-[12px]">
          {Number(h.startDate.slice(5, 7))}월 {Number(h.startDate.slice(8, 10))}일부터
        </span>
        {h.rate30 !== null && <span className="text-ink-3 text-[12px] tabular-nums">최근 30일 {h.rate30}%</span>}
        {h.streak > 1 && (
          <span className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-[#ea580c]">
            <Flame className="size-3.5" />
            {h.streak}일 연속
          </span>
        )}
        {h.status === 'PAUSED' && <span className="text-ink-3 text-[12px]">쉬는 중</span>}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-4">
        {months.map((m) => (
          <Month key={m} month={m} today={today} start={h.startDate} states={states} />
        ))}
      </div>
    </li>
  )
}

/** 한 달 달력 — 월요일부터 7칸 */
function Month({
  month,
  today,
  start,
  states,
}: {
  month: string
  today: string
  start: string
  states: Map<string, HabitDayState> | undefined
}) {
  const last = lastOfMonth(month)
  const lead = weekdayIndex(month)
  const days: string[] = []
  for (let d = month; d <= last; d = addDays(d, 1)) days.push(d)

  const stateAt = (d: string): HabitDayState =>
    d > today ? 'FUTURE' : d < start ? 'BEFORE_START' : (states?.get(d) ?? 'BEFORE_START')
  const cells = days.map((d) => ({ d, s: stateAt(d) }))
  const doneDays = cells.filter((c) => c.s === 'DONE').length
  const dueDays = cells.filter((c) => c.s === 'DONE' || c.s === 'MISSED' || c.s === 'TODO').length
  const sameYear = month.slice(0, 4) === today.slice(0, 4)

  return (
    <div>
      <p className="mb-1 flex items-baseline justify-between gap-2 text-[12px]">
        <span className="font-semibold">
          {sameYear ? '' : `${month.slice(0, 4)}년 `}
          {Number(month.slice(5, 7))}월
        </span>
        {dueDays > 0 && (
          <span className="text-ink-3 tabular-nums">
            {doneDays}/{dueDays}일
          </span>
        )}
      </p>
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(7, ${CELL}px)`, gap: GAP }}
        role="grid"
        aria-label={`${Number(month.slice(5, 7))}월 ${doneDays}일 했어요`}
      >
        {WEEKDAY_LABEL.map((w) => (
          <span key={w} className="text-ink-4 text-center text-[9px] leading-[12px]" aria-hidden>
            {w}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`l${i}`} />
        ))}
        {cells.map(({ d, s }) => (
          <span
            key={d}
            role="gridcell"
            title={
              STATE_LABEL[s] ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))} · ${STATE_LABEL[s]}` : undefined
            }
            className={cn(
              'rounded-[3px]',
              STATE_CLASS[s],
              s === 'BEFORE_START' && 'bg-subtle/40',
              d === today && 'ring-ink-2 ring-1 ring-offset-1'
            )}
            style={{ width: CELL, height: CELL }}
          />
        ))}
      </div>
    </div>
  )
}

function Legend({ className, children }: { className: string; children: string }) {
  return (
    <span className="flex items-center gap-1">
      <i className={cn('inline-block size-[11px] rounded-[3px]', className)} />
      {children}
    </span>
  )
}
