'use client'

import type { MouseEvent } from 'react'
import { CalendarDays, Check, Flag } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { useMonthlyTimetable } from '../api'
import { hexOf } from '../layout'
import { WEEKDAY_LABEL, dDay, dayOfMonth, formatMonthDay, hm, monthOf, monthWeeks, weekdayIndex, yearOf } from '../time'
import type { MonthlyDay, TimeBlockTask, TimetableDay } from '../types'

interface Props {
  /** 선택한 날짜 (이 날짜가 속한 달을 보여줘요) */
  date: string
  today: string
  /** 선택한 날짜의 상세 (GET /timetable?startDate=date&endDate=date) */
  dayDetail?: TimetableDay
  dayLoading: boolean
  onSelectDate: (date: string) => void
  onOpenDay: (date: string) => void
  onSelectTask: (t: TimeBlockTask, e: MouseEvent<HTMLElement>) => void
  onToggleComplete: (t: TimeBlockTask) => void
  togglingId?: number | null
}

/** 실행률 막대 색: 80% 이상 초록 · 50% 이상 파랑 · 그 아래 주황 */
const rateColor = (rate: number) => (rate >= 80 ? 'bg-success' : rate >= 50 ? 'bg-brand' : 'bg-warning')

/**
 * 월간 보기 (명세 3-5, 8)
 *  - 날짜 칸: 실행률 막대, Task 칩 3개 + "+n개 더보기", 마일스톤 🏁
 *  - 날짜를 누르면 오른쪽 패널에 그날 실행률 · 이번 주 마감 · 시간순 Task (체크 가능)
 *  - 날짜를 두 번 누르거나 "일간 보기"를 누르면 그날 일간 보기
 */
export function MonthView({
  date,
  today,
  dayDetail,
  dayLoading,
  onSelectDate,
  onOpenDay,
  onSelectTask,
  onToggleComplete,
  togglingId,
}: Props) {
  const year = yearOf(date)
  const month = monthOf(date)
  const { data, isPending, isError, refetch } = useMonthlyTimetable(year, month)
  // placeholderData 로 이전 달 데이터가 잠깐 남아 있을 수 있어 해당 달인지 확인
  const current = data && data.year === year && data.month === month ? data : undefined
  const byDate = new Map((current?.days ?? []).map((d) => [d.date, d]))
  const weeks = monthWeeks(year, month)

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="overflow-hidden p-0">
        <div className="border-line grid grid-cols-7 border-b">
          {WEEKDAY_LABEL.map((w, i) => (
            <div
              key={w}
              className={cn(
                'py-2.5 text-center text-xs font-semibold',
                i === 6 ? 'text-danger' : i === 5 ? 'text-brand' : 'text-ink-3'
              )}
            >
              {w}
            </div>
          ))}
        </div>

        {isError && !current ? (
          <div className="grid min-h-[320px] place-items-center p-8 text-center">
            <div>
              <p className="font-bold">월간 TimeTable을 불러오지 못했어요</p>
              <Button variant="secondary" className="mt-4" onClick={() => refetch()}>
                다시 시도
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative" aria-busy={isPending}>
            {isPending && (
              <div className="bg-surface/60 absolute inset-0 z-10 grid place-items-center">
                <Spinner className="text-ink-3 size-6" />
              </div>
            )}
            {weeks.map((week) => (
              <div key={week[0]} className="border-line grid grid-cols-7 border-b last:border-b-0">
                {week.map((d) => (
                  <DayCell
                    key={d}
                    date={d}
                    inMonth={monthOf(d) === month}
                    day={byDate.get(d)}
                    today={today}
                    selected={d === date}
                    onSelect={() => onSelectDate(d)}
                    onOpen={() => onOpenDay(d)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </Card>

      <DayPanel
        date={date}
        today={today}
        summary={byDate.get(date)}
        detail={dayDetail}
        loading={dayLoading}
        deadlines={current?.deadlinesThisWeek ?? []}
        onOpenDay={onOpenDay}
        onSelectTask={onSelectTask}
        onToggleComplete={onToggleComplete}
        togglingId={togglingId}
      />
    </div>
  )
}

function DayCell({
  date,
  inMonth,
  day,
  today,
  selected,
  onSelect,
  onOpen,
}: {
  date: string
  inMonth: boolean
  day?: MonthlyDay
  today: string
  selected: boolean
  onSelect: () => void
  onOpen: () => void
}) {
  const wd = weekdayIndex(date)
  const isToday = date === today
  const past = date <= today
  const rate = day?.rate ?? null

  return (
    <button
      type="button"
      data-month-date={date}
      onClick={onSelect}
      onDoubleClick={onOpen}
      aria-pressed={selected}
      aria-label={`${formatMonthDay(date)}${day?.taskCount ? ` Task ${day.taskCount}개` : ''}${rate != null && past ? ` 실행률 ${rate}%` : ''}`}
      className={cn(
        'border-line relative flex min-h-[76px] min-w-0 flex-col gap-1 border-l p-1.5 text-left transition-colors first:border-l-0 sm:min-h-[118px] sm:p-2',
        inMonth ? 'hover:bg-subtle/60' : 'bg-canvas/60',
        selected && 'bg-brand-soft/60 hover:bg-brand-soft/60 ring-brand ring-2 ring-inset'
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span
          className={cn(
            'grid size-6 shrink-0 place-items-center rounded-full text-[13px] font-bold',
            isToday
              ? 'bg-brand text-white'
              : !inMonth
                ? 'text-ink-4'
                : wd === 6
                  ? 'text-danger'
                  : wd === 5
                    ? 'text-brand'
                    : 'text-ink'
          )}
        >
          {dayOfMonth(date)}
        </span>
        {/* 실행률: 지난 날·오늘만 (앞으로 올 날은 개수) */}
        {inMonth && day && day.taskCount > 0 && (
          <span className="text-ink-3 hidden truncate text-[11px] font-semibold tabular-nums sm:inline">
            {past && rate != null ? `${rate}%` : `${day.taskCount}개`}
          </span>
        )}
      </div>

      {inMonth && day && past && rate != null && (
        <span className="bg-subtle block h-1 w-full overflow-hidden rounded-full" aria-hidden>
          <span
            className={cn('block h-full rounded-full', rateColor(rate))}
            style={{ width: `${Math.max(rate, 4)}%` }}
          />
        </span>
      )}

      {inMonth && day && (
        <>
          {day.milestones.map((m) => (
            <span
              key={m.milestoneId}
              className="hidden truncate rounded px-1 py-0.5 text-[11px] font-semibold sm:block"
              style={{ color: hexOf(m.colorCode), backgroundColor: 'var(--color-subtle)' }}
            >
              🏁 {m.title}
            </span>
          ))}
          {/* 넓은 화면: 칩 / 좁은 화면: 점 */}
          <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
            {day.chips.map((c) => (
              <span key={c.taskId} className="flex min-w-0 items-center gap-1 text-[11px] leading-tight">
                <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: hexOf(c.colorCode) }} />
                <span className={cn('truncate', c.completed ? 'text-ink-4 line-through' : 'text-ink-2')}>
                  {c.title}
                </span>
              </span>
            ))}
            {day.moreCount > 0 && <span className="text-ink-3 text-[11px]">+{day.moreCount}개 더보기</span>}
          </span>
          <span className="flex flex-wrap gap-0.5 sm:hidden" aria-hidden>
            {day.milestones.length > 0 && <span className="text-[9px] leading-none">🏁</span>}
            {day.chips.map((c) => (
              <span
                key={c.taskId}
                className={cn('size-1.5 rounded-full', c.completed && 'opacity-40')}
                style={{ backgroundColor: hexOf(c.colorCode) }}
              />
            ))}
          </span>
        </>
      )}
    </button>
  )
}

function DayPanel({
  date,
  today,
  summary,
  detail,
  loading,
  deadlines,
  onOpenDay,
  onSelectTask,
  onToggleComplete,
  togglingId,
}: {
  date: string
  today: string
  summary?: MonthlyDay
  detail?: TimetableDay
  loading: boolean
  deadlines: { type: 'TASK' | 'MILESTONE'; id: number; title: string; date: string; colorCode?: string | null }[]
  onOpenDay: (date: string) => void
  onSelectTask: (t: TimeBlockTask, e: MouseEvent<HTMLElement>) => void
  onToggleComplete: (t: TimeBlockTask) => void
  togglingId?: number | null
}) {
  // 시간순 (시간 미정은 맨 뒤)
  const tasks = detail
    ? [...detail.tasks].sort((a, b) => (a.plannedStartAt ?? '').localeCompare(b.plannedStartAt ?? ''))
    : []
  const unscheduled = detail?.unscheduledTasks ?? []
  const stats = detail?.stats
  const rate = stats?.rate ?? null

  return (
    <Card
      className="flex flex-col gap-5 p-5 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-48px)] lg:overflow-y-auto"
      aria-label="선택한 날짜"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[17px] font-bold">
          {formatMonthDay(date)}
          {date === today && <span className="text-brand ml-1.5 text-[13px]">오늘</span>}
        </h3>
        <Button variant="secondary" size="sm" onClick={() => onOpenDay(date)}>
          <CalendarDays className="size-3.5" />
          일간 보기
        </Button>
      </div>

      {/* 실행률 */}
      <div className="bg-subtle rounded-2xl p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-ink-3 text-xs font-medium">{date > today ? '계획된 Task' : '실행률'}</p>
            <p className="mt-0.5 text-[26px] leading-none font-bold tabular-nums">
              {date > today ? `${stats?.total ?? summary?.taskCount ?? 0}개` : rate != null ? `${rate}%` : '–'}
            </p>
          </div>
          {stats && stats.total > 0 && (
            <p className="text-ink-3 text-xs tabular-nums">
              완료 {stats.completed} / 전체 {stats.total}
              {stats.missed > 0 && <span className="text-danger"> · 놓침 {stats.missed}</span>}
            </p>
          )}
        </div>
        {date <= today && rate != null && (
          <span className="bg-surface mt-3 block h-1.5 overflow-hidden rounded-full">
            <span
              className={cn('block h-full rounded-full', rateColor(rate))}
              style={{ width: `${Math.max(rate, 3)}%` }}
            />
          </span>
        )}
      </div>

      {/* 그날 마일스톤 */}
      {summary && summary.milestones.length > 0 && (
        <section>
          <h4 className="text-ink-3 mb-2 text-xs font-semibold">마일스톤</h4>
          <ul className="space-y-1.5">
            {summary.milestones.map((m) => (
              <li key={m.milestoneId} className="flex items-center gap-2 text-sm">
                <Flag className="size-3.5 shrink-0" style={{ color: hexOf(m.colorCode) }} />
                <span className="truncate">{m.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 이번 주 마감 */}
      {deadlines.length > 0 && (
        <section>
          <h4 className="text-ink-3 mb-2 text-xs font-semibold">이번 주 마감</h4>
          <ul className="space-y-1.5">
            {deadlines.map((d) => (
              <li key={`${d.type}-${d.id}`} className="flex items-center gap-2 text-sm">
                {d.type === 'MILESTONE' ? (
                  <Flag className="size-3.5 shrink-0" style={{ color: hexOf(d.colorCode) }} />
                ) : (
                  <span className="mx-1 size-2 shrink-0 rounded-full" style={{ backgroundColor: hexOf(d.colorCode) }} />
                )}
                <span className="min-w-0 flex-1 truncate">{d.title}</span>
                <span
                  className={cn(
                    'shrink-0 text-xs font-semibold tabular-nums',
                    d.date <= today ? 'text-danger' : 'text-ink-3'
                  )}
                >
                  {dDay(d.date, today)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 그날 Task (시간순, 체크 가능) */}
      <section>
        <h4 className="text-ink-3 mb-2 text-xs font-semibold">할 일</h4>
        {loading && !detail ? (
          <div className="grid h-24 place-items-center">
            <Spinner className="text-ink-4 size-5" />
          </div>
        ) : tasks.length + unscheduled.length === 0 ? (
          <p className="text-ink-3 bg-subtle rounded-xl px-4 py-6 text-center text-sm">이날은 Task가 없어요.</p>
        ) : (
          <ul className="space-y-1">
            {[...tasks, ...unscheduled].map((t) => (
              <TaskRow
                key={t.taskId}
                task={t}
                busy={togglingId === t.taskId}
                onSelect={onSelectTask}
                onToggle={onToggleComplete}
              />
            ))}
          </ul>
        )}
      </section>
    </Card>
  )
}

function TaskRow({
  task: t,
  busy,
  onSelect,
  onToggle,
}: {
  task: TimeBlockTask
  busy: boolean
  onSelect: (t: TimeBlockTask, e: MouseEvent<HTMLElement>) => void
  onToggle: (t: TimeBlockTask) => void
}) {
  const done = t.taskStatus === 'COMPLETED'
  return (
    <li className="hover:bg-subtle/70 flex items-center gap-2.5 rounded-xl px-2 py-1.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`${t.taskName} ${done ? '완료 취소' : '완료'}`}
        disabled={busy}
        onClick={() => onToggle(t)}
        className={cn(
          'grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors disabled:opacity-50',
          done ? 'border-success bg-success text-white' : 'border-line-strong hover:border-ink-4 bg-white'
        )}
      >
        {done && <Check className="size-3" strokeWidth={3.5} />}
      </button>
      <button
        type="button"
        data-task-id={t.taskId}
        onClick={(e) => onSelect(t, e)}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span className="text-ink-3 w-[52px] shrink-0 text-xs tabular-nums">
          {t.plannedStartAt ? hm(t.plannedStartAt) : '시간 미정'}
        </span>
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: hexOf(t.goalColorCode) }} />
        <span className={cn('min-w-0 flex-1 truncate text-sm', done && 'text-ink-4 line-through')}>
          {t.emoji ? `${t.emoji} ` : ''}
          {t.taskName}
        </span>
        {t.missed && <span className="text-danger shrink-0 text-[11px] font-semibold">놓침</span>}
      </button>
    </li>
  )
}
