'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Flame } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { addDays, weekdayIndex, WEEKDAY_LABEL } from '@/features/timetable/time'
import { Section } from '@/features/goal/ui/sections'
import { useHabitHeatmap, type HabitDayState, type HabitHeatmap as Heatmap } from '../api'

/** 칸 크기 · 간격 (px) — 깃허브 잔디처럼 */
const CELL = 13
const GAP = 3
/** 습관별 줄: 최근 4주 · 조금 작은 칸 */
const RECENT_DAYS = 28
const SMALL = 10

/** 하루 진하기 0~4 → 색 (0 = 안 함) */
const LEVEL_CLASS = ['bg-subtle', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4', 'bg-heat-5'] as const

/** 습관별 줄의 칸 */
const STATE_CLASS: Record<HabitDayState, string> = {
  DONE: 'bg-brand',
  MISSED: 'bg-line-strong',
  TODO: 'bg-surface ring-brand ring-[1.5px] ring-inset',
  OFF: 'bg-transparent',
  PAUSED: 'bg-hatch ring-hatch-line ring-1 ring-inset',
  BEFORE_START: 'bg-transparent',
  FUTURE: 'bg-transparent',
}

const STATE_LABEL: Record<HabitDayState, string> = {
  DONE: '했어요',
  MISSED: '놓쳤어요',
  TODO: '오늘 아직',
  OFF: '쉬는 요일',
  PAUSED: '쉬는 중',
  BEFORE_START: '시작 전',
  FUTURE: '',
}

/** from ~ to 를 월요일부터 시작하는 주(열)로 */
function toWeeks(data: Heatmap) {
  const lead = weekdayIndex(data.from)
  const first = addDays(data.from, -lead)
  const weeks: string[] = []
  for (let w = first; w <= data.to; w = addDays(w, 7)) weeks.push(w)
  return weeks
}

/**
 * 생활 습관 잔디맵 — 위: 모든 습관을 합친 하루(진할수록 그날 할 습관을 많이 함), 아래: 습관별 최근 5주.
 * 체크했다는 사실만 쌓이는 습관이라, 매일 열어 보며 "끊기지 않게" 하는 게 목적이에요.
 */
export function HabitHeatmap() {
  const { data, isPending } = useHabitHeatmap()
  const scroller = useRef<HTMLDivElement>(null)
  const weeks = useMemo(() => (data ? toWeeks(data) : []), [data])
  const levelByDate = useMemo(() => new Map((data?.days ?? []).map((d) => [d.date, d])), [data])

  // 처음 열면 오늘(맨 오른쪽)이 보이게
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [weeks])

  if (isPending) {
    return (
      <Section title="잔디">
        <div className="grid h-32 place-items-center">
          <Spinner className="text-ink-3 size-5" />
        </div>
      </Section>
    )
  }
  if (!data || data.habits.length === 0) return null

  const activeDays = data.days.filter((d) => d.done > 0).length
  // 습관별 줄은 최근 4주만 — 한 줄에 들어오게 (길면 한눈에 안 들어와요)
  const recentFrom = Math.max(data.days.length - RECENT_DAYS, 0)

  return (
    <Section title="잔디" aside={`최근 ${data.days.length}일 중 ${activeDays}일 체크`}>
      <div ref={scroller} className="-mx-1 overflow-x-auto px-1 pb-2">
        <div className="inline-flex flex-col" style={{ minWidth: '100%' }}>
          {/* 달 표시 */}
          <div className="mb-1 flex pl-6" style={{ gap: GAP }} aria-hidden>
            {weeks.map((w, i) => {
              const showMonth = i === 0 || w.slice(5, 7) !== weeks[i - 1].slice(5, 7)
              return (
                <span key={w} className="text-ink-3 relative text-[11px]" style={{ width: CELL, height: 14 }}>
                  {showMonth && <span className="absolute left-0 whitespace-nowrap">{Number(w.slice(5, 7))}월</span>}
                </span>
              )
            })}
          </div>
          <div className="flex flex-col" style={{ gap: GAP }} role="grid" aria-label="날짜별 습관 체크">
            {WEEKDAY_LABEL.map((label, di) => (
              <div key={label} className="flex items-center" style={{ gap: GAP }} role="row">
                <span className="text-ink-3 w-5 shrink-0 text-[10px]">{di % 2 === 0 ? label : ''}</span>
                {weeks.map((w) => {
                  const ymd = addDays(w, di)
                  const day = levelByDate.get(ymd)
                  if (!day) return <span key={w} className="shrink-0" style={{ width: CELL, height: CELL }} />
                  return (
                    <span
                      key={w}
                      role="gridcell"
                      title={`${ymd} · ${day.done} / ${day.scheduled}개`}
                      className={cn(
                        'shrink-0 rounded-[3px]',
                        LEVEL_CLASS[day.level] ?? LEVEL_CLASS[0],
                        ymd === data.today && 'ring-ink-2 ring-1 ring-offset-1'
                      )}
                      style={{ width: CELL, height: CELL }}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="text-ink-3 mt-1 flex items-center justify-end gap-1 text-[11px]" aria-hidden>
        적게
        {LEVEL_CLASS.map((c) => (
          <span key={c} className={cn('size-[11px] rounded-[3px]', c)} />
        ))}
        많이
      </div>

      {/* 습관별 최근 4주 */}
      <ul className="border-line mt-5 space-y-3 border-t pt-4">
        {data.habits.map((h) => {
          const cells = h.cells.slice(recentFrom)
          return (
            <li key={h.habitId} className={cn(h.status === 'PAUSED' && 'opacity-60')}>
              <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 text-[13px]">
                <span className="font-semibold">
                  {h.emoji ? `${h.emoji} ` : ''}
                  {h.name}
                </span>
                {h.rate !== null && <span className="text-ink-3 tabular-nums">실천률 {h.rate}%</span>}
                {h.streak > 1 && (
                  <span className="inline-flex items-center gap-0.5 font-semibold text-[#ea580c]">
                    <Flame className="size-3.5" />
                    {h.streak}일 연속
                  </span>
                )}
                {h.status === 'PAUSED' && <span className="text-ink-3">쉬는 중</span>}
              </div>
              <div className="flex" style={{ gap: GAP }}>
                {cells.map((s, i) => {
                  const date = data.days[recentFrom + i]?.date
                  return (
                    <span
                      key={date ?? i}
                      title={STATE_LABEL[s] ? `${date} · ${STATE_LABEL[s]}` : undefined}
                      className={cn(
                        'shrink-0 rounded-[3px]',
                        STATE_CLASS[s],
                        (s === 'OFF' || s === 'BEFORE_START') && 'bg-subtle/50'
                      )}
                      style={{ width: SMALL, height: SMALL }}
                    />
                  )
                })}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="text-ink-3 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <Legend className="bg-brand">했어요</Legend>
        <Legend className="bg-line-strong">놓쳤어요</Legend>
        <Legend className="bg-hatch ring-hatch-line ring-1 ring-inset">쉬는 중</Legend>
        <Legend className="bg-subtle/50">쉬는 요일</Legend>
      </p>
    </Section>
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
