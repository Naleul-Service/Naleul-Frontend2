'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarClock, CalendarX2, RotateCcw, Sparkles } from 'lucide-react'
import { Button, buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { useReplan, useTimetable } from '@/features/timetable/api'
import { visibleHours } from '@/features/timetable/layout'
import { addDays, formatMonthDay, hm } from '@/features/timetable/time'
import { TimeGrid } from '@/features/timetable/ui/TimeGrid'
import { useTimetableInteractions } from '@/features/timetable/ui/useTimetableInteractions'
import type { ConfirmResponse } from '../types'

const MAX_DAYS = 7

/**
 * 3단계 · TimeBlock 확인 (명세 3-2)
 *  - 날짜별 TimeTable 미리보기 (새로 만든 블록은 NEW) — 캘린더와 같은 격자라 끌어서 옮길 수 있어요
 *  - 블록마다 배치 이유 · 다른 날로 배치된 Task · 시간 미정 Task
 *  - 임시 목표 안내 → AI 목표 만들기로 구체화
 */
export function StepResult({
  result,
  today,
  onAddMore,
}: {
  result: ConfirmResponse
  today: string
  onAddMore: () => void
}) {
  const newIds = useMemo(
    () =>
      new Set([
        ...result.placements.map((p) => p.taskId),
        ...result.movedToOtherDays.map((p) => p.taskId),
        ...result.unscheduled.map((u) => u.taskId),
      ]),
    [result]
  )

  // 보여줄 기간: 결과가 있는 첫날부터 마지막 날까지 (최대 7일)
  const dates = useMemo(() => {
    const all = [
      ...result.placements.map((p) => p.date),
      ...result.movedToOtherDays.map((p) => p.date),
      ...result.unscheduled.map((u) => u.date).filter((d): d is string => !!d),
    ].sort()
    return all.length ? all : [today]
  }, [result, today])
  const start = dates[0]
  const lastWanted = dates[dates.length - 1]
  const end = lastWanted > addDays(start, MAX_DAYS - 1) ? addDays(start, MAX_DAYS - 1) : lastWanted

  const { data, isPending } = useTimetable(start, end)
  const rawDays = useMemo(() => (data?.days ?? []).filter((d) => d.date >= start && d.date <= end), [data, start, end])
  const { days, selection, onSelectTask, onSelectFixed, onDrop, close, overlays } = useTimetableInteractions(
    rawDays,
    start
  )
  const { startHour, endHour } = useMemo(() => visibleHours(days), [days])

  const replan = useReplan()
  const replanDates = [...new Set(dates)].filter((d) => d >= today)

  const placedNow = result.placements.filter((p) => !p.locked)
  const lockedNow = result.placements.filter((p) => p.locked)

  return (
    <div className="space-y-4">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-bold">TimeBlock을 만들었어요</h2>
            <p className="text-ink-3 mt-1 text-sm">
              {result.placements.length}개를 배치했어요
              {result.movedToOtherDays.length > 0 && ` · 다른 날로 ${result.movedToOtherDays.length}개`}
              {result.unscheduled.length > 0 && ` · 시간 미정 ${result.unscheduled.length}개`}. 블록을 끌어서 옮기면 그
              시간으로 잠겨요.
            </p>
          </div>
          <div className="flex gap-2">
            {replanDates.length > 0 && (
              <Button variant="secondary" onClick={() => replan.mutate(replanDates)} loading={replan.isPending}>
                <RotateCcw className="size-4" />
                다시 배치
              </Button>
            )}
          </div>
        </div>

        {/* 임시 목표 안내 */}
        {result.tempGoals.map((t) => (
          <div
            key={t.goalCategoryId}
            className="bg-warning-soft mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3"
          >
            <p className="text-sm text-[#92400e]">
              <b>
                {t.emoji ? `${t.emoji} ` : ''}
                {t.name}
              </b>
              은(는) 임시 목표로 만들어졌어요. 목표를 구체화해볼까요?
            </p>
            <Link href={`/goal/new?sourceGoalId=${t.goalCategoryId}`} className={buttonClass('secondary', 'sm')}>
              <Sparkles className="size-3.5" />
              AI로 구체화하기
            </Link>
          </div>
        ))}
      </Card>

      {/* 미리보기 격자 */}
      {isPending ? (
        <Card className="grid min-h-[320px] place-items-center">
          <Spinner className="text-ink-3 size-6" />
        </Card>
      ) : (
        <TimeGrid
          days={days}
          startHour={startHour}
          endHour={endHour}
          selection={selection}
          onSelectTask={onSelectTask}
          onSelectFixed={onSelectFixed}
          onDrop={onDrop}
          onDragStart={close}
          highlightIds={newIds}
          maxHeightClass="max-h-[560px]"
        />
      )}
      {lastWanted > end && (
        <p className="text-ink-3 text-xs">
          {formatMonthDay(addDays(end, 1))} 이후에 놓인 Task는 캘린더에서 확인할 수 있어요.
        </p>
      )}

      {/* 배치 이유 */}
      <Card className="p-5 sm:p-6">
        <h3 className="text-[15px] font-bold">이렇게 배치했어요</h3>
        <ul className="mt-3 space-y-2.5">
          {placedNow.map((p) => (
            <ReasonRow
              key={p.taskId}
              title={p.title}
              when={`${formatMonthDay(p.date)} ${hm(p.start)}–${hm(p.end)}`}
              reason={p.reason}
            />
          ))}
          {lockedNow.map((p) => (
            <ReasonRow
              key={p.taskId}
              title={p.title}
              when={`${formatMonthDay(p.date)} ${hm(p.start)}–${hm(p.end)}`}
              reason="직접 정한 시간이에요 🔒"
            />
          ))}
          {result.placements.length === 0 && <li className="text-ink-3 text-sm">그날 안에 놓인 Task가 없어요.</li>}
        </ul>

        {result.movedToOtherDays.length > 0 && (
          <>
            <h3 className="mt-6 flex items-center gap-1.5 text-[15px] font-bold">
              <CalendarClock className="size-4" />
              다른 날로 배치된 Task
            </h3>
            <ul className="mt-3 space-y-2.5">
              {result.movedToOtherDays.map((p) => (
                <ReasonRow
                  key={p.taskId}
                  title={p.title}
                  when={`${formatMonthDay(p.date)} ${hm(p.start)}–${hm(p.end)}`}
                  reason={p.reason}
                />
              ))}
            </ul>
          </>
        )}

        {result.unscheduled.length > 0 && (
          <>
            <h3 className="mt-6 flex items-center gap-1.5 text-[15px] font-bold">
              <CalendarX2 className="size-4" />
              시간 미정
            </h3>
            <p className="text-ink-3 mt-1 text-xs">
              빈 시간이 없어서 날짜만 정했어요. 격자의 &quot;시간 미정&quot;에서 끌어다 놓을 수 있어요.
            </p>
            <ul className="mt-2 space-y-1.5">
              {result.unscheduled.map((u) => (
                <li key={u.taskId} className="text-sm">
                  {u.title}
                  {u.date && <span className="text-ink-3"> · {formatMonthDay(u.date)}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onAddMore}>
          Task 더 추가하기
        </Button>
        <Link href={`/calendar?view=week&date=${start}`} className={cn(buttonClass('primary'))}>
          이대로 진행하기
          <ArrowRight className="size-4" />
        </Link>
      </div>

      {overlays}
    </div>
  )
}

function ReasonRow({ title, when, reason }: { title: string; when: string; reason?: string | null }) {
  return (
    <li className="flex items-start gap-3">
      <span className="bg-danger mt-1 shrink-0 rounded px-1 text-[9px] leading-[14px] font-bold text-white">NEW</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          {title}
          <span className="text-ink-3 ml-2 text-xs font-normal tabular-nums">{when}</span>
        </p>
        {reason && <p className="text-ink-3 mt-0.5 text-xs leading-relaxed">{reason}</p>}
      </div>
    </li>
  )
}
