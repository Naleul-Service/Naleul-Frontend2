'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, PencilLine, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { useHabitHome, useToggleHabitCheck, type Habit } from '@/features/habit/api'
import { useTimetable, useToggleComplete } from '@/features/timetable/api'
import { addDays, formatMinutes, monthOf, dayOfMonth, nowKst, weekdayIndex } from '@/features/timetable/time'
import type { TimeBlockTask } from '@/features/timetable/types'
import { useHomeToday } from '../api'
import { agendaOf, inLabel, isDone, isRoutineTask, startMinutes, tasksOfDay } from '../today'
import { HomeDayCalendar } from './HomeDayCalendar'
import { TodayRoutines, TodayTasks } from './TodayChecklist'
import { RetroPanel } from './TodayRetro'
import { DeadlineRoadmap, UpcomingSchedule } from './Upcoming'

const WEEKDAY_FULL = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일']

/** 1분마다 바뀌는 지금 (한국 시간) */
function useNow() {
  const [now, setNow] = useState(() => nowKst())
  useEffect(() => {
    const id = setInterval(() => setNow(nowKst()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}

/**
 * 홈 — 오늘 해야 할 것만 한곳에.
 *  1. 오늘 요약 (얼마나 했는지 · 지금/다음 할 일)
 *  2. 오늘 일간 캘린더 (캘린더 화면과 같은 계획 | 실제) · 할 일 · 루틴과 생활 습관 (바로 체크)
 *  3. 다가오는 일정 (6일) · 마감 로드맵 (Task · 업무형 주제 · 목표형 종료일을 날짜순 세로 선으로)
 *  넓은 화면에선 스크롤 없이 한 화면: 요약 한 줄 · 캘린더(1/3) · 할 일 | 루틴·습관 / 다가오는 일정 | 마감 로드맵
 *  오늘 회고는 요약의 "오늘 회고" 버튼 → 오른쪽 패널 (캘린더의 Task 추가 패널처럼)
 */
export function HomeView({ userName }: { userName: string }) {
  const now = useNow()
  const realToday = now.date
  // 날짜 ‹ › 로 고른 날 (null = 오늘을 따라가요 — 자정이 지나면 저절로 다음 날)
  const [picked, setPicked] = useState<string | null>(null)
  const today = picked ?? realToday
  const isToday = today === realToday
  const isFuture = today > realToday
  const week = useTimetable(today, addDays(today, 6))
  // 습관은 앞날 체크가 안 돼서 오늘까지만 그날 기준으로 불러와요
  const habits = useHabitHome(isToday ? undefined : isFuture ? undefined : today)
  const home = useHomeToday(isToday ? undefined : today)
  const toggle = useToggleComplete()
  const toggleHabit = useToggleHabitCheck(isToday || isFuture ? undefined : today)
  const [retroOpen, setRetroOpen] = useState(false)
  const go = (d: string) => setPicked(d === realToday ? null : d)
  const nav = {
    today,
    isToday,
    onPrev: () => go(addDays(today, -1)),
    onNext: () => go(addDays(today, 1)),
    onToday: () => go(realToday),
  }

  if (week.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <DayNav {...nav} className="self-start" />
        <div className="grid min-h-[420px] place-items-center">
          <Spinner className="text-ink-3 size-6" />
        </div>
      </div>
    )
  }
  if (week.isError || !week.data) {
    return (
      <div className="flex flex-col gap-4">
        <DayNav {...nav} className="self-start" />
        <Card className="p-8 text-center">
          <p className="font-bold">{isToday ? '오늘' : '이날'} 일정을 불러오지 못했어요</p>
          <p className="text-ink-3 mt-1 text-sm">{week.error?.message}</p>
          <Button className="mt-4" onClick={() => week.refetch()}>
            다시 시도
          </Button>
        </Card>
      </div>
    )
  }

  const [day, ...rest] = week.data.days
  const all = tasksOfDay(day)
  const tasks = all.filter((t) => !isRoutineTask(t)).sort((a, b) => startMinutes(today, a) - startMinutes(today, b))
  const routines = all.filter(isRoutineTask).sort((a, b) => startMinutes(today, a) - startMinutes(today, b))
  const togglingId = toggle.isPending ? (toggle.variables?.taskId ?? null) : null

  // 완료하면 캘린더 · 홈(목표별 오늘 끝낸 일 · 마감)이 같이 다시 불러와져요 (timetable/api 의 공통 처리)
  const onToggle = (t: TimeBlockTask) => toggle.mutate(t)
  const onToggleHabit = (h: Habit) => toggleHabit.mutate({ habit: h, day: today })

  const retroLeft = (home.data?.goals ?? []).filter((g) => g.activeToday && g.retros.length === 0).length
  // 앞날은 습관을 체크할 수 없어서 빼요 (루틴 Task 는 보여요)
  const habitsShown = isFuture ? undefined : habits.data

  return (
    // 넓은 화면(lg~): 한 화면에 다 보이게 — 요약 한 줄 + 칸 나누기(캘린더 1/3 · 나머지 2×2), 넘치면 칸 안에서 스크롤
    // 회고 패널이 열리면 아주 넓은 화면(2xl~)에선 옆으로 비켜서 나란히, 그보다 좁으면 위에 덮어요
    <div className={cn('flex flex-col gap-4 lg:h-[calc(100dvh-4rem)] lg:min-h-[640px]', retroOpen && '2xl:pr-[416px]')}>
      <Summary
        userName={userName}
        nav={nav}
        nowMinutes={now.minutes}
        tasks={tasks}
        routines={routines}
        habitDone={habitsShown?.doneCount ?? 0}
        habitTotal={habitsShown?.scheduledCount ?? 0}
        agendaTasks={agendaOf(day).flatMap((it) => (it.kind === 'task' ? [it] : []))}
        dueToday={(home.data?.deadlines ?? []).filter((d) => d.dDay === 0).length}
        overdue={(home.data?.deadlines ?? []).filter((d) => d.overdue).length}
        retroLeft={retroLeft}
        onRetro={() => setRetroOpen(true)}
      />

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3 lg:grid-rows-2">
        <HomeDayCalendar day={day} className="lg:row-span-2" dayLabel={isToday ? '오늘' : '이날'} />
        <TodayTasks
          today={today}
          tasks={tasks}
          onToggle={onToggle}
          togglingId={togglingId}
          dayLabel={isToday ? '오늘' : '이날'}
        />
        <TodayRoutines
          dayLabel={isToday ? '오늘' : '이날'}
          today={today}
          routines={routines}
          habits={habitsShown}
          onToggleTask={onToggle}
          onToggleHabit={onToggleHabit}
          togglingId={togglingId}
        />
        <UpcomingSchedule days={rest} today={today} />
        <DeadlineRoadmap deadlines={home.data?.deadlines} failed={home.isError} />
      </div>

      {retroOpen && (
        <RetroSidePanel
          title={isToday ? '오늘 회고' : `${monthOf(today)}월 ${dayOfMonth(today)}일 회고`}
          onClose={() => setRetroOpen(false)}
        >
          {/* 날짜가 바뀌면 입력 중이던 상태를 새로 시작해요 */}
          <RetroPanel key={today} goals={home.data?.goals} today={today} failed={home.isError} bare />
        </RetroSidePanel>
      )}
    </div>
  )
}

/** 오른쪽 회고 패널 — 캘린더의 "Task 추가" 패널과 같은 자리 · 모양 */
function RetroSidePanel({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  // Esc 로 닫기 — 입력 중이거나 다른 창(모달 · 팝오버)이 떠 있으면 그쪽이 먼저
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const el = e.target instanceof HTMLElement ? e.target : null
      if (el?.closest('input, textarea, select, [role="dialog"]')) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <aside
      aria-label={title}
      className="bg-canvas border-line shadow-pop fixed inset-0 z-40 flex animate-[slide-in-right_180ms_ease-out] flex-col sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[400px] sm:border-l 2xl:shadow-none"
    >
      <div className="border-line bg-surface flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <PencilLine className="size-4" />
        <p className="text-[16px] font-bold">{title}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label={`${title} 닫기`}
          className="text-ink-3 hover:bg-subtle hover:text-ink ml-auto rounded-lg p-1.5"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
    </aside>
  )
}

interface DayNavProps {
  today: string
  isToday: boolean
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}

/** 날짜 ‹ › — 지난날 · 앞날의 홈을 볼 수 있어요 (오늘이 아니면 "오늘" 버튼) */
function DayNav({
  today,
  isToday,
  onPrev,
  onNext,
  onToday,
  className,
  dark = false,
}: DayNavProps & { className?: string; dark?: boolean }) {
  const btn = cn(
    'grid size-7 place-items-center rounded-lg',
    dark ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-ink-3 hover:bg-subtle hover:text-ink'
  )
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <button type="button" onClick={onPrev} aria-label="이전 날" className={btn}>
        <ChevronLeft className="size-4" />
      </button>
      <span className={cn('text-[13px] font-semibold tabular-nums', dark ? 'text-white/80' : 'text-ink-2')}>
        {monthOf(today)}월 {dayOfMonth(today)}일 {WEEKDAY_FULL[weekdayIndex(today)]}
      </span>
      <button type="button" onClick={onNext} aria-label="다음 날" className={btn}>
        <ChevronRight className="size-4" />
      </button>
      {!isToday && (
        <button
          type="button"
          onClick={onToday}
          className={cn(
            'ml-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold',
            dark ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-subtle text-ink hover:bg-line'
          )}
        >
          오늘
        </button>
      )}
    </div>
  )
}

/** 요약 한 줄 — 날짜(‹ ›) · 인사 · 진행률 · 지금/다음 할 일 · 회고 쓰기 */
function Summary({
  userName,
  nav,
  nowMinutes,
  tasks,
  routines,
  habitDone,
  habitTotal,
  agendaTasks,
  dueToday,
  overdue,
  retroLeft,
  onRetro,
}: {
  userName: string
  nav: DayNavProps
  nowMinutes: number
  tasks: TimeBlockTask[]
  routines: TimeBlockTask[]
  habitDone: number
  habitTotal: number
  agendaTasks: { start: number; end: number; task: TimeBlockTask }[]
  dueToday: number
  overdue: number
  retroLeft: number
  onRetro: () => void
}) {
  const { today, isToday } = nav
  const isPast = !isToday && today < nowKst().date
  const taskDone = tasks.filter(isDone).length
  const routineDone = routines.filter(isDone).length
  const total = tasks.length + routines.length + habitTotal
  const done = taskDone + routineDone + habitDone
  const percent = total ? Math.round((done / total) * 100) : 0
  const left = total - done

  const open = agendaTasks.filter((a) => !isDone(a.task))
  const current = open.find((a) => a.start <= nowMinutes && nowMinutes < a.end)
  const next = open.find((a) => a.start > nowMinutes)
  const focus = current ?? next

  return (
    <section className="bg-inverse flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3 rounded-[20px] px-5 py-4 text-white">
      <div className="min-w-0">
        <DayNav {...nav} dark className="-ml-1.5" />
        <h1 className="truncate text-[19px] leading-snug font-bold">
          {isToday
            ? total === 0
              ? `${userName}님, 오늘은 비어 있어요`
              : left === 0
                ? `${userName}님, 오늘 할 일을 모두 끝냈어요 🎉`
                : `${userName}님, 오늘 ${left}개 남았어요`
            : total === 0
              ? '이날은 비어 있어요'
              : isPast
                ? left === 0
                  ? `이날 할 일을 모두 끝냈어요 🎉`
                  : `이날 ${total}개 중 ${done}개를 했어요`
                : `이날 할 일 ${total}개가 잡혀 있어요`}
        </h1>
      </div>

      <div className="flex min-w-[180px] items-center gap-3">
        <span className="text-[26px] leading-none font-bold tabular-nums">{percent}%</span>
        <div>
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-white transition-all" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1 text-[11px] whitespace-nowrap text-white/65 tabular-nums">
            할 일 {taskDone}/{tasks.length}
            {routines.length > 0 && ` · 루틴 ${routineDone}/${routines.length}`}
            {habitTotal > 0 && ` · 습관 ${habitDone}/${habitTotal}`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 text-[12px]">
        {dueToday > 0 && <Pill tone="warning">오늘 마감 {dueToday}</Pill>}
        {overdue > 0 && <Pill tone="danger">마감 지남 {overdue}</Pill>}
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {isToday && (
          <div className="max-w-[260px] min-w-0 rounded-xl bg-white/8 px-3 py-1.5">
            <p className="text-[11px] font-semibold text-white/60">{current ? '지금 할 일' : '다음 일정'}</p>
            {focus ? (
              <p className="truncate text-[13px] font-bold">
                {formatMinutes(focus.start)} {focus.task.emoji ? `${focus.task.emoji} ` : ''}
                {focus.task.taskName}
                {!current && <span className="font-medium text-white/70"> · {inLabel(focus.start - nowMinutes)}</span>}
              </p>
            ) : (
              <p className="text-[13px] font-semibold text-white/80">남은 일정이 없어요</p>
            )}
          </div>
        )}
        <Button variant="secondary" size="sm" onClick={onRetro}>
          <PencilLine className="size-4" />
          {isToday ? '오늘 회고' : '이날 회고'}
          {retroLeft > 0 && (
            <span className="bg-brand grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-white">
              {retroLeft}
            </span>
          )}
        </Button>
      </div>
    </section>
  )
}

function Pill({ children, tone }: { children: React.ReactNode; tone?: 'danger' | 'warning' }) {
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 font-semibold tabular-nums',
        tone === 'danger'
          ? 'bg-[#EF4444]/25 text-[#FECACA]'
          : tone === 'warning'
            ? 'bg-[#F59E0B]/25 text-[#FDE68A]'
            : 'bg-white/12 text-white/90'
      )}
    >
      {children}
    </span>
  )
}
