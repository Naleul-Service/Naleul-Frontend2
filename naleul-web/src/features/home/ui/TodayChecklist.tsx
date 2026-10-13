'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Flame, Plus, Repeat } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import type { Habit, HabitHome } from '@/features/habit/api'
import { hexOf } from '@/features/timetable/layout'
import { addDays, dDay, hm } from '@/features/timetable/time'
import type { TimeBlockTask } from '@/features/timetable/types'
import { isDone } from '../today'
import { TaskCheck } from './TaskCheck'

/** 오늘 할 일 — 루틴이 아닌 Task. 남은 일(시간순, 시간 미정은 아래) → 끝낸 일(접힘) */
export function TodayTasks({
  today,
  tasks,
  onToggle,
  togglingId,
}: {
  today: string
  tasks: TimeBlockTask[]
  onToggle: (t: TimeBlockTask) => void
  togglingId: number | null
}) {
  const [showDone, setShowDone] = useState(false)
  const todo = tasks.filter((t) => !isDone(t))
  const done = tasks.filter(isDone)

  return (
    <Card className="p-5 sm:p-6">
      <Header title="할 일" done={done.length} total={tasks.length}>
        <Link
          href="/tasks/new"
          className="text-ink-3 hover:text-ink flex items-center gap-0.5 text-[13px] font-semibold"
          aria-label="Task 추가"
        >
          <Plus className="size-4" />
          추가
        </Link>
      </Header>
      {tasks.length === 0 ? (
        <p className="text-ink-3 py-4 text-sm">오늘로 정한 할 일이 없어요.</p>
      ) : (
        <>
          {todo.length === 0 ? (
            <p className="text-success py-2 text-[14px] font-semibold">오늘 할 일을 모두 끝냈어요 🎉</p>
          ) : (
            <ul className="-my-1">
              {todo.map((t) => (
                <TaskRow key={t.taskId} t={t} today={today} onToggle={onToggle} busy={togglingId === t.taskId} />
              ))}
            </ul>
          )}
          {done.length > 0 && (
            <div className="border-line mt-2 border-t pt-2">
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                aria-expanded={showDone}
                className="text-success flex items-center gap-1 text-[13px] font-semibold"
              >
                끝낸 일 {done.length}
                <ChevronDown className={cn('size-4 transition-transform', showDone && 'rotate-180')} />
              </button>
              {showDone && (
                <ul>
                  {done.map((t) => (
                    <TaskRow key={t.taskId} t={t} today={today} onToggle={onToggle} busy={togglingId === t.taskId} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  )
}

/** 오늘 루틴 — 목표에서 반복으로 만든 루틴 Task + 기본 생활 습관 체크 */
export function TodayRoutines({
  today,
  routines,
  habits,
  onToggleTask,
  onToggleHabit,
  togglingId,
}: {
  today: string
  routines: TimeBlockTask[]
  habits: HabitHome | undefined
  onToggleTask: (t: TimeBlockTask) => void
  onToggleHabit: (h: Habit) => void
  togglingId: number | null
}) {
  const todayHabits = (habits?.habits ?? []).filter((h) => h.status === 'ACTIVE' && h.scheduled)
  const total = routines.length + todayHabits.length
  const done = routines.filter(isDone).length + todayHabits.filter((h) => h.checked).length
  // 안 한 것 먼저
  const sortedRoutines = [...routines].sort((a, b) => Number(isDone(a)) - Number(isDone(b)))
  const sortedHabits = [...todayHabits].sort((a, b) => Number(a.checked) - Number(b.checked))

  return (
    <Card className="p-5 sm:p-6">
      <Header title="루틴 · 습관" done={done} total={total} />
      {total === 0 ? (
        <p className="text-ink-3 py-4 text-sm">
          오늘 할 루틴이 없어요.{' '}
          <Link href="/goal" className="text-brand font-semibold">
            생활 습관 추가하기
          </Link>
        </p>
      ) : (
        <>
          {sortedRoutines.length > 0 && (
            <>
              <SubTitle>목표 루틴</SubTitle>
              <ul className="mb-2">
                {sortedRoutines.map((t) => (
                  <TaskRow key={t.taskId} t={t} today={today} onToggle={onToggleTask} busy={togglingId === t.taskId} />
                ))}
              </ul>
            </>
          )}
          {sortedHabits.length > 0 && (
            <>
              <SubTitle>
                <Link href={habits ? `/goal/${habits.goalCategoryId}` : '/goal'} className="hover:text-ink">
                  {habits?.emoji ?? '🌱'} 생활 습관
                </Link>
              </SubTitle>
              <ul>
                {sortedHabits.map((h) => (
                  <li key={h.habitId} className="flex items-center gap-2.5 py-1.5">
                    <TaskCheck done={h.checked} label={h.name} onToggle={() => onToggleHabit(h)} />
                    <span className={cn('min-w-0 flex-1 truncate text-[14px]', h.checked && 'text-ink-3 line-through')}>
                      {h.emoji ? `${h.emoji} ` : ''}
                      {h.name}
                    </span>
                    {h.streak > 1 && (
                      <span className="flex shrink-0 items-center text-[11px] font-semibold text-[#ea580c]">
                        <Flame className="size-3" />
                        {h.streak}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Card>
  )
}

function Header({
  title,
  done,
  total,
  children,
}: {
  title: string
  done: number
  total: number
  children?: React.ReactNode
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <h2 className="text-[17px] font-bold">{title}</h2>
        {total > 0 && (
          <span className="text-ink-3 text-[13px] tabular-nums">
            {done} / {total}
          </span>
        )}
        <span className="ml-auto">{children}</span>
      </div>
      {total > 0 && (
        <div className="bg-subtle mt-2 h-1.5 overflow-hidden rounded-full">
          <div
            className="bg-success h-full rounded-full transition-all"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
      )}
    </div>
  )
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-ink-3 mt-1 mb-0.5 text-[12px] font-semibold">{children}</p>
}

function TaskRow({
  t,
  today,
  onToggle,
  busy,
}: {
  t: TimeBlockTask
  today: string
  onToggle: (t: TimeBlockTask) => void
  busy: boolean
}) {
  const done = isDone(t)
  return (
    <li className="flex items-center gap-2.5 py-1.5">
      <TaskCheck
        done={done}
        label={t.taskName}
        onToggle={() => onToggle(t)}
        disabled={busy || t.sourceType === 'MISSION'}
      />
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: hexOf(t.goalColorCode) }} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-[14px]', done ? 'text-ink-3 line-through' : 'font-medium')}>
          {t.emoji ? `${t.emoji} ` : ''}
          {t.taskName}
        </p>
        {t.goalCategoryName && !t.goalTemporary && (
          <p className="text-ink-4 truncate text-[11px]">{t.goalCategoryName}</p>
        )}
      </div>
      {t.sourceType === 'ROUTINE' && <Repeat className="text-ink-4 size-3.5 shrink-0" aria-label="루틴" />}
      {t.dueDate && !done && t.dueDate <= addDays(today, 2) && (
        <span
          className={cn(
            'shrink-0 rounded px-1.5 text-[10px] font-bold',
            t.dueDate < today ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning-ink'
          )}
        >
          {t.dueDate < today ? dDay(t.dueDate, today) : `${dDay(t.dueDate, today)} 마감`}
        </span>
      )}
      {t.missed && !done && (
        <span className="bg-danger-soft text-danger shrink-0 rounded px-1.5 text-[10px] font-bold">놓침</span>
      )}
      <span className="text-ink-3 w-[40px] shrink-0 text-right text-[12px] tabular-nums">
        {t.plannedStartAt ? hm(t.plannedStartAt) : '미정'}
      </span>
    </li>
  )
}
