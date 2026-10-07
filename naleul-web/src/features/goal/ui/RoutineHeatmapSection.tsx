'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Flame } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { addDays, startOfWeek, todayKst, weekdayIndex } from '@/features/timetable/time'
import { useRoutineHeatmap, type GoalCategory, type RoutineHeatmap } from '../api'
import { JAVA_DAYS, JAVA_DAY_LABEL } from '../format'
import { Section } from './sections'

/** 칸 크기·간격 (px) — 깃허브 잔디처럼 작게 */
const CELL = 13
const GAP = 3

type CellState = 'none' | 'done' | 'missed' | 'today' | 'future'

const CELL_CLASS: Record<CellState, string> = {
  none: 'bg-transparent',
  done: 'bg-brand',
  missed: 'bg-line-strong',
  today: 'bg-surface ring-brand ring-[1.5px] ring-inset',
  future: 'bg-subtle',
}

/** 이 루틴이 그날 해야 하는 날인지 (기간 안 + 반복 요일) */
const isScheduled = (r: RoutineHeatmap, ymd: string, dayIndex: number) =>
  ymd >= r.repeatStartDate && (!r.repeatEndDate || ymd <= r.repeatEndDate) && r.repeatDays.includes(JAVA_DAYS[dayIndex])

function stats(r: RoutineHeatmap, today: string) {
  const done = new Set(r.completedDates)
  let due = 0
  let completed = 0
  const end = r.repeatEndDate && r.repeatEndDate < today ? r.repeatEndDate : today
  for (let d = r.repeatStartDate; d <= end; d = addDays(d, 1)) {
    if (!r.repeatDays.includes(JAVA_DAYS[weekdayIndex(d)])) continue
    due++
    if (done.has(d)) completed++
  }
  return { due, completed, rate: due ? Math.round((completed / due) * 100) : null }
}

/**
 * 루틴 실천 히트맵 — 루틴마다 "해야 하는 요일만" 칸으로 그려요 (월·수·금 루틴이면 월·수·금 3줄).
 * 실행한 날은 색이 채워지고, 지나갔는데 안 한 날은 회색, 아직 안 온 날은 옅게.
 * 모든 루틴이 같은 주(열)를 공유해서 한눈에 비교할 수 있어요. 각 루틴 아래에 따로 두면 비교가 어려워요.
 */
export function RoutineHeatmapSection({ goal }: { goal: GoalCategory }) {
  const { data, isPending } = useRoutineHeatmap(goal.goalCategoryId)
  const today = todayKst()
  const routines = useMemo(
    () =>
      (data ?? [])
        .filter((r) => r.repeatDays.length > 0)
        .sort((a, b) => a.repeatStartDate.localeCompare(b.repeatStartDate)),
    [data]
  )
  const scroller = useRef<HTMLDivElement>(null)

  // 모든 루틴이 함께 쓰는 주(열) 목록: 가장 이른 시작 주 ~ 가장 늦은 종료 주
  const weeks = useMemo(() => {
    if (!routines.length) return []
    const first = startOfWeek(
      routines.reduce((m, r) => (r.repeatStartDate < m ? r.repeatStartDate : m), routines[0].repeatStartDate)
    )
    const lastEnd = routines.reduce((m, r) => {
      const e = r.repeatEndDate ?? addDays(today, 28)
      return e > m ? e : m
    }, today)
    const list: string[] = []
    for (let w = first; w <= lastEnd && list.length < 106; w = addDays(w, 7)) list.push(w)
    return list
  }, [routines, today])

  // 처음 열면 오늘이 보이게 가로 스크롤
  useEffect(() => {
    const el = scroller.current
    if (!el || !weeks.length) return
    const idx = weeks.findIndex((w) => w > today) - 1
    const col = idx < 0 ? weeks.length - 1 : idx
    el.scrollLeft = Math.max(col * (CELL + GAP) - el.clientWidth + 120, 0)
  }, [weeks, today])

  if (isPending) {
    return (
      <Section title="루틴 실천">
        <div className="grid h-24 place-items-center">
          <Spinner className="text-ink-3 size-5" />
        </div>
      </Section>
    )
  }
  if (!routines.length) return null

  const totals = routines.map((r) => stats(r, today))
  const allDue = totals.reduce((n, s) => n + s.due, 0)
  const allDone = totals.reduce((n, s) => n + s.completed, 0)

  return (
    <Section
      title="루틴 실천"
      aside={allDue ? `전체 ${allDone} / ${allDue}회 · ${Math.round((allDone / allDue) * 100)}%` : undefined}
    >
      <p className="text-ink-3 -mt-2 mb-4 text-[13px]">
        해야 하는 요일만 칸으로 보여줘요. 실천한 날은 색이 채워지고, 놓친 날은 회색이에요.
      </p>

      <div ref={scroller} className="-mx-1 overflow-x-auto px-1 pb-2">
        <div className="inline-flex flex-col gap-5" style={{ minWidth: '100%' }}>
          {/* 달 표시 */}
          <div className="flex pl-7" style={{ gap: GAP }} aria-hidden>
            {weeks.map((w, i) => {
              const showMonth = i === 0 || w.slice(5, 7) !== weeks[i - 1].slice(5, 7)
              return (
                <span key={w} className="text-ink-3 relative text-[11px]" style={{ width: CELL, height: 14 }}>
                  {showMonth && <span className="absolute left-0 whitespace-nowrap">{Number(w.slice(5, 7))}월</span>}
                </span>
              )
            })}
          </div>

          {routines.map((r, ri) => {
            const s = totals[ri]
            const done = new Set(r.completedDates)
            const rows = JAVA_DAYS.map((d, i) => ({ d, i })).filter(({ d }) => r.repeatDays.includes(d))
            return (
              <div key={r.routineId}>
                <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pr-2">
                  <span className="text-[14px] font-semibold">{r.routineName}</span>
                  <span className="text-ink-3 text-[12px] tabular-nums">
                    {s.completed} / {s.due}회{s.rate !== null ? ` · ${s.rate}%` : ''}
                  </span>
                  {r.currentStreak > 1 && (
                    <span className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-[#ea580c]">
                      <Flame className="size-3.5" />
                      {r.currentStreak}회 연속
                    </span>
                  )}
                </div>
                <div className="flex flex-col" style={{ gap: GAP }}>
                  {rows.map(({ d, i }) => (
                    <div key={d} className="flex items-center" style={{ gap: GAP }}>
                      <span className="text-ink-3 w-6 shrink-0 text-[11px]">{JAVA_DAY_LABEL[d]}</span>
                      {weeks.map((w) => {
                        const ymd = addDays(w, i)
                        const state: CellState = !isScheduled(r, ymd, i)
                          ? 'none'
                          : done.has(ymd)
                            ? 'done'
                            : ymd > today
                              ? 'future'
                              : ymd === today
                                ? 'today'
                                : 'missed'
                        return (
                          <span
                            key={w}
                            title={state === 'none' ? undefined : `${ymd} · ${STATE_LABEL[state]}`}
                            className={cn('shrink-0 rounded-[3px]', CELL_CLASS[state])}
                            style={{ width: CELL, height: CELL }}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 범례 */}
      <div className="text-ink-3 mt-3 flex flex-wrap items-center gap-3 text-[12px]">
        {(['done', 'missed', 'today', 'future'] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={cn('inline-block rounded-[3px]', CELL_CLASS[k])} style={{ width: 11, height: 11 }} />
            {STATE_LABEL[k]}
          </span>
        ))}
      </div>
    </Section>
  )
}

const STATE_LABEL: Record<Exclude<CellState, 'none'>, string> = {
  done: '실천',
  missed: '놓침',
  today: '오늘',
  future: '예정',
}
