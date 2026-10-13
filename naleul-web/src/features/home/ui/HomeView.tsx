'use client'

import { useEffect, useState } from 'react'
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
 *  오른쪽: 오늘 회고 — 입력창 하나로 목표를 차례로 넘기며 써요
 */
export function HomeView({ userName }: { userName: string }) {
  const now = useNow()
  const today = now.date
  const week = useTimetable(today, addDays(today, 6))
  const habits = useHabitHome()
  const home = useHomeToday()
  const toggle = useToggleComplete()
  const toggleHabit = useToggleHabitCheck()

  if (week.isPending) {
    return (
      <div className="grid min-h-[420px] place-items-center">
        <Spinner className="text-ink-3 size-6" />
      </div>
    )
  }
  if (week.isError || !week.data) {
    return (
      <Card className="p-8 text-center">
        <p className="font-bold">오늘 일정을 불러오지 못했어요</p>
        <p className="text-ink-3 mt-1 text-sm">{week.error?.message}</p>
        <Button className="mt-4" onClick={() => week.refetch()}>
          다시 시도
        </Button>
      </Card>
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

  return (
    <div className="space-y-5">
      <Hero
        userName={userName}
        today={today}
        nowMinutes={now.minutes}
        tasks={tasks}
        routines={routines}
        habitDone={habits.data?.doneCount ?? 0}
        habitTotal={habits.data?.scheduledCount ?? 0}
        agendaTasks={agendaOf(day).flatMap((it) => (it.kind === 'task' ? [{ ...it, task: it.task }] : []))}
        dueToday={(home.data?.deadlines ?? []).filter((d) => d.dDay === 0).length}
        overdue={(home.data?.deadlines ?? []).filter((d) => d.overdue).length}
      />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* 오늘 회고 — 넓은 화면에선 오른쪽에 붙어서 따라와요 (좁은 화면에선 맨 아래) */}
        <aside className="lg:sticky lg:top-4 lg:order-last">
          <RetroPanel goals={home.data?.goals} today={today} failed={home.isError} />
        </aside>

        <div className="min-w-0 space-y-5">
          <HomeDayCalendar day={day} />

          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-2">
            <TodayTasks today={today} tasks={tasks} onToggle={onToggle} togglingId={togglingId} />
            <TodayRoutines
              today={today}
              routines={routines}
              habits={habits.data}
              onToggleTask={onToggle}
              onToggleHabit={onToggleHabit}
              togglingId={togglingId}
            />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-2">
            <UpcomingSchedule days={rest} today={today} />
            <DeadlineRoadmap deadlines={home.data?.deadlines} failed={home.isError} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Hero({
  userName,
  today,
  nowMinutes,
  tasks,
  routines,
  habitDone,
  habitTotal,
  agendaTasks,
  dueToday,
  overdue,
}: {
  userName: string
  today: string
  nowMinutes: number
  tasks: TimeBlockTask[]
  routines: TimeBlockTask[]
  habitDone: number
  habitTotal: number
  agendaTasks: { start: number; end: number; task: TimeBlockTask }[]
  dueToday: number
  overdue: number
}) {
  const taskDone = tasks.filter(isDone).length
  const routineDone = routines.filter(isDone).length
  const total = tasks.length + routines.length + habitTotal
  const done = taskDone + routineDone + habitDone
  const percent = total ? Math.round((done / total) * 100) : null
  const left = total - done

  // 지금 하고 있어야 할 일, 없으면 다음 일
  const open = agendaTasks.filter((a) => !isDone(a.task))
  const current = open.find((a) => a.start <= nowMinutes && nowMinutes < a.end)
  const next = open.find((a) => a.start > nowMinutes)
  const focus = current ?? next

  return (
    <section className="bg-inverse rounded-[24px] p-6 text-white sm:p-7">
      <p className="text-[13px] text-white/70">
        {monthOf(today)}월 {dayOfMonth(today)}일 {WEEKDAY_FULL[weekdayIndex(today)]}
      </p>
      <h1 className="mt-1 text-[24px] leading-snug font-bold sm:text-[28px]">
        {total === 0
          ? `${userName}님, 오늘은 비어 있어요`
          : left === 0
            ? `${userName}님, 오늘 할 일을 모두 끝냈어요 🎉`
            : `${userName}님, 오늘 ${left}개 남았어요`}
      </h1>

      <div className="mt-5 flex flex-wrap items-end gap-x-10 gap-y-5">
        <div className="min-w-[200px] flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[40px] leading-none font-bold tabular-nums">{percent ?? 0}%</span>
            <span className="text-[14px] text-white/70">
              {done} / {total}개 끝냄
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-white transition-all" style={{ width: `${percent ?? 0}%` }} />
          </div>
        </div>

        <div className="min-w-[220px] flex-1 rounded-2xl bg-white/8 px-4 py-3">
          <p className="text-[12px] font-semibold text-white/60">{current ? '지금 할 일' : '다음 일정'}</p>
          {focus ? (
            <>
              <p className="mt-0.5 truncate text-[16px] font-bold">
                {focus.task.emoji ? `${focus.task.emoji} ` : ''}
                {focus.task.taskName}
              </p>
              <p className="text-[13px] text-white/75">
                {formatMinutes(focus.start)} ~ {formatMinutes(focus.end)}
                {!current && ` · ${inLabel(focus.start - nowMinutes)}`}
              </p>
            </>
          ) : (
            <p className="mt-0.5 text-[15px] font-semibold text-white/85">남은 일정이 없어요</p>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-[13px]">
        <Pill>
          할 일 {taskDone}/{tasks.length}
        </Pill>
        {routines.length > 0 && (
          <Pill>
            루틴 {routineDone}/{routines.length}
          </Pill>
        )}
        {habitTotal > 0 && (
          <Pill>
            습관 {habitDone}/{habitTotal}
          </Pill>
        )}
        {dueToday > 0 && <Pill tone="warning">오늘 마감 {dueToday}개</Pill>}
        {overdue > 0 && <Pill tone="danger">마감 지남 {overdue}개</Pill>}
      </div>
    </section>
  )
}

function Pill({ children, tone }: { children: React.ReactNode; tone?: 'danger' | 'warning' }) {
  return (
    <span
      className={cn(
        'rounded-full px-3 py-1 font-semibold tabular-nums',
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
