'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flame,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { JAVA_DAYS, JAVA_DAY_LABEL } from '@/features/goal/format'
import { InlineConfirm } from '@/features/goal/edit/inline'
import type { GoalCategory } from '@/features/goal/api'
import { addDays, todayKst, weekdayIndex, WEEKDAY_LABEL } from '@/features/timetable/time'
import {
  useCreateHabit,
  useDeleteHabit,
  useHabitHome,
  usePauseHabit,
  useResumeHabit,
  useToggleHabitCheck,
  useUpdateHabit,
  type Habit,
  type HabitDayState,
} from '../api'
import { HABIT_SUGGESTIONS, HabitForm } from './HabitForm'
import { GoalTaskList } from '@/features/goal/ui/GoalTaskList'
import { HabitHeatmap } from './HabitHeatmap'

// ─── 표시 도우미 ───────────────────────────────────────────────

/** "매일" · "평일" · "주말" · "월·수·금" */
export function daysLabel(h: Pick<Habit, 'daily' | 'repeatDays'>) {
  if (h.daily || h.repeatDays.length === 7) return '매일'
  const set = new Set(h.repeatDays)
  const weekdays = JAVA_DAYS.slice(0, 5)
  if (set.size === 5 && weekdays.every((d) => set.has(d))) return '평일'
  if (set.size === 2 && set.has('SATURDAY') && set.has('SUNDAY')) return '주말'
  return JAVA_DAYS.filter((d) => set.has(d))
    .map((d) => JAVA_DAY_LABEL[d])
    .join('·')
}

/** "오늘" · "어제" · "10월 11일 (토)" */
function dayTitle(ymd: string, today: string) {
  if (ymd === today) return '오늘'
  if (ymd === addDays(today, -1)) return '어제'
  return `${Number(ymd.slice(5, 7))}월 ${Number(ymd.slice(8, 10))}일 (${WEEKDAY_LABEL[weekdayIndex(ymd)]})`
}

const DOT: Record<HabitDayState, string> = {
  DONE: 'bg-brand',
  MISSED: 'bg-line-strong',
  TODO: 'ring-brand bg-surface ring-[1.5px] ring-inset',
  OFF: 'bg-subtle',
  PAUSED: 'bg-hatch ring-hatch-line ring-1 ring-inset',
  BEFORE_START: 'bg-subtle',
  FUTURE: 'bg-subtle',
}

// ─── 습관 한 줄 ────────────────────────────────────────────────

function HabitRow({ habit, day, isToday }: { habit: Habit; day: string; isToday: boolean }) {
  const toggle = useToggleHabitCheck(isToday ? undefined : day)
  const update = useUpdateHabit()
  const pause = usePauseHabit()
  const resume = useResumeHabit()
  const remove = useDeleteHabit()
  const [mode, setMode] = useState<'view' | 'edit' | 'delete'>('view')
  const paused = habit.status === 'PAUSED'

  if (mode === 'edit') {
    return (
      <li className="py-2">
        <HabitForm
          initial={habit}
          saving={update.isPending}
          submitLabel="저장"
          onCancel={() => setMode('view')}
          onSubmit={(v) => update.mutate({ habitId: habit.habitId, ...v }, { onSuccess: () => setMode('view') })}
          extra={
            <button
              type="button"
              onClick={() => setMode('delete')}
              className="text-danger hover:bg-danger-soft flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-semibold"
            >
              <Trash2 className="size-3.5" />
              습관 지우기
            </button>
          }
        />
      </li>
    )
  }
  if (mode === 'delete') {
    return (
      <li className="py-2">
        <InlineConfirm
          message={`'${habit.name}' 습관을 지울까요?`}
          detail="지금까지 체크한 기록도 화면에서 사라져요. 잠깐 쉬려면 '쉬기'를 써 주세요."
          loading={remove.isPending}
          onCancel={() => setMode('view')}
          onConfirm={() => remove.mutate(habit.habitId)}
        />
      </li>
    )
  }

  return (
    <li className={cn('group flex items-center gap-3 py-3', paused && 'opacity-60')}>
      <button
        type="button"
        onClick={() => toggle.mutate({ habit, day })}
        disabled={paused}
        aria-pressed={habit.checked}
        aria-label={`${habit.name} ${habit.checked ? '체크 풀기' : '했어요'}`}
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-full border-2 transition-all active:scale-95',
          habit.checked
            ? 'border-brand bg-brand text-white'
            : 'border-line-strong hover:border-brand hover:text-brand/40 text-transparent',
          paused && 'cursor-not-allowed'
        )}
      >
        <Check className="size-5" strokeWidth={3} />
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={cn('truncate text-[15px] font-semibold', habit.checked && 'text-ink-3 line-through decoration-2')}
        >
          {habit.emoji ? `${habit.emoji} ` : ''}
          {habit.name}
        </p>
        <p className="text-ink-3 mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px]">
          <span>{daysLabel(habit)}</span>
          {habit.remindTime && (
            <span className="flex items-center gap-0.5">
              <Bell className="size-3" />
              {habit.remindTime}
            </span>
          )}
          {habit.rate30 !== null && <span>30일 {habit.rate30}%</span>}
          {paused && <span className="text-warning-ink font-semibold">쉬는 중</span>}
        </p>
      </div>

      {habit.streak > 1 && (
        <span className="hidden shrink-0 items-center gap-0.5 text-[12px] font-semibold text-[#ea580c] sm:flex">
          <Flame className="size-3.5" />
          {habit.streak}일
        </span>
      )}
      {/* 최근 7일 */}
      <span className="hidden shrink-0 gap-[3px] sm:flex" aria-label="최근 7일">
        {habit.recent7.map((c) => (
          <i key={c.date} title={c.date} className={cn('block size-2.5 rounded-[3px]', DOT[c.state])} />
        ))}
      </span>

      <span className="flex shrink-0 items-center transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
        <IconButton label={`${habit.name} 수정`} onClick={() => setMode('edit')}>
          <Pencil className="size-3.5" />
        </IconButton>
        {paused ? (
          <IconButton label={`${habit.name} 다시 시작`} onClick={() => resume.mutate(habit.habitId)}>
            <Play className="size-3.5" />
          </IconButton>
        ) : (
          <IconButton label={`${habit.name} 쉬기`} onClick={() => pause.mutate(habit.habitId)}>
            <Pause className="size-3.5" />
          </IconButton>
        )}
      </span>
    </li>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="text-ink-3 hover:bg-subtle hover:text-ink rounded-lg p-1.5"
    >
      {children}
    </button>
  )
}

// ─── 추가 ─────────────────────────────────────────────────────

function AddHabit({ existing }: { existing: Habit[] }) {
  const [open, setOpen] = useState(false)
  const create = useCreateHabit()
  const names = new Set(existing.map((h) => h.name))
  const suggestions = HABIT_SUGGESTIONS.filter((s) => !names.has(s.name))

  return (
    <div className="mt-4">
      {open ? (
        <HabitForm
          saving={create.isPending}
          submitLabel="습관 추가"
          onCancel={() => setOpen(false)}
          onSubmit={(v) => create.mutate(v, { onSuccess: () => setOpen(false) })}
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="border-line-strong text-ink-3 hover:border-ink-4 hover:text-ink-2 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed py-2.5 text-sm font-semibold transition-colors"
        >
          <Plus className="size-4" />
          습관 추가
        </button>
      )}
      {suggestions.length > 0 && !open && (
        <div className="mt-3">
          <p className="text-ink-3 mb-1.5 text-[12px] font-medium">눌러서 바로 추가</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.slice(0, 10).map((s) => (
              <button
                key={s.name}
                type="button"
                disabled={create.isPending}
                onClick={() => create.mutate({ name: s.name, emoji: s.emoji, repeatDays: s.repeatDays ?? [] })}
                className="border-line hover:border-line-strong hover:bg-subtle h-8 rounded-full border px-3 text-[13px] disabled:opacity-50"
              >
                {s.emoji} {s.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 화면 ──────────────────────────────────────────────────────

/**
 * 기본 생활 습관 (goalMode = HABIT) — 목표 상세 대신 이 화면을 보여줘요.
 *  - 위: 날짜(어제 · 그제도 체크할 수 있어요) + 오늘 몇 개 했는지
 *  - 왼쪽: 해야 하는 습관 체크 목록 · 오늘은 안 해도 되는 습관 · 쉬는 습관
 *  - 오른쪽: 일회성 할 일 (병원 가기 · 친구 만나기) — 습관과 달리 한 번 하고 끝나요
 *  - 아래: 습관별 잔디 (추가한 달부터 한 달씩)
 */
export function HabitView({ goal }: { goal: GoalCategory }) {
  const today = todayKst()
  const [day, setDay] = useState(today)
  const isToday = day === today
  const { data, isPending, isError, error, refetch } = useHabitHome(isToday ? undefined : day)
  const [showOff, setShowOff] = useState(false)

  const habits = data?.habits ?? []
  const due = habits.filter((h) => h.status === 'ACTIVE' && h.scheduled)
  const off = habits.filter((h) => h.status === 'ACTIVE' && !h.scheduled)
  const paused = habits.filter((h) => h.status === 'PAUSED')
  const done = due.filter((h) => h.checked).length
  const ratio = due.length ? done / due.length : 0

  return (
    <>
      <p className="text-ink-3 text-[13px]">
        <Link href="/goal" className="hover:text-ink">
          목표
        </Link>{' '}
        › {goal.goalCategoryName}
      </p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-[30px]">
        {goal.emoji ? `${goal.emoji} ` : ''}
        {goal.goalCategoryName}
      </h1>
      <p className="text-ink-3 mt-1.5 text-sm">
        했는지만 체크하는 생활 습관과, 병원 가기처럼 한 번만 할 일을 여기서 챙겨요.
      </p>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="p-5 sm:p-6">
          {/* 날짜 + 진행 */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDay(addDays(day, -1))}
              aria-label="전날"
              className="text-ink-3 hover:bg-subtle hover:text-ink rounded-lg p-1.5"
            >
              <ChevronLeft className="size-5" />
            </button>
            <h2 className="min-w-[96px] text-center text-[17px] font-bold">{dayTitle(day, today)}</h2>
            <button
              type="button"
              onClick={() => setDay(addDays(day, 1))}
              disabled={isToday}
              aria-label="다음 날"
              className="text-ink-3 hover:bg-subtle hover:text-ink rounded-lg p-1.5 disabled:opacity-30"
            >
              <ChevronRight className="size-5" />
            </button>
            {!isToday && (
              <button type="button" onClick={() => setDay(today)} className="text-brand text-[13px] font-semibold">
                오늘로
              </button>
            )}
            <span className="ml-auto text-[15px] font-bold tabular-nums">
              {done}
              <span className="text-ink-3 font-semibold"> / {due.length}</span>
            </span>
          </div>
          <div className="bg-subtle mt-3 h-2 overflow-hidden rounded-full" aria-hidden>
            <div className="bg-brand h-full rounded-full transition-all" style={{ width: `${ratio * 100}%` }} />
          </div>
          {due.length > 0 && done === due.length && (
            <p className="text-success mt-2 text-[13px] font-semibold">
              {isToday ? '오늘 할 습관을 모두 챙겼어요 🎉' : '이날 할 습관을 모두 챙겼어요'}
            </p>
          )}

          {isPending ? (
            <div className="grid h-40 place-items-center">
              <Spinner className="text-ink-3 size-5" />
            </div>
          ) : isError ? (
            <div className="py-10 text-center">
              <p className="font-bold">습관을 불러오지 못했어요</p>
              <p className="text-ink-3 mt-1 text-sm">{error.message}</p>
              <Button className="mt-4" onClick={() => refetch()}>
                다시 시도
              </Button>
            </div>
          ) : habits.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-[16px] font-bold">아직 습관이 없어요</p>
              <p className="text-ink-3 mt-1 text-sm">영양제 · 물 마시기처럼 매일 챙길 것을 아래에서 골라 보세요.</p>
            </div>
          ) : (
            <>
              {due.length > 0 ? (
                <ul className="divide-line mt-2 divide-y">
                  {due.map((h) => (
                    <HabitRow key={h.habitId} habit={h} day={day} isToday={isToday} />
                  ))}
                </ul>
              ) : (
                <p className="text-ink-3 py-6 text-center text-sm">{dayTitle(day, today)}은 해야 하는 습관이 없어요.</p>
              )}

              {off.length > 0 && (
                <div className="border-line mt-2 border-t pt-3">
                  <button
                    type="button"
                    onClick={() => setShowOff((v) => !v)}
                    aria-expanded={showOff}
                    className="text-ink-3 hover:text-ink-2 flex items-center gap-1 text-[13px] font-semibold"
                  >
                    {dayTitle(day, today)}은 안 해도 되는 습관 {off.length}
                    <ChevronDown className={cn('size-4 transition-transform', showOff && 'rotate-180')} />
                  </button>
                  {showOff && (
                    <ul className="divide-line divide-y">
                      {off.map((h) => (
                        <HabitRow key={h.habitId} habit={h} day={day} isToday={isToday} />
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {paused.length > 0 && (
                <div className="border-line mt-2 border-t pt-3">
                  <p className="text-ink-3 text-[13px] font-semibold">쉬는 중 {paused.length}</p>
                  <ul className="divide-line divide-y">
                    {paused.map((h) => (
                      <HabitRow key={h.habitId} habit={h} day={day} isToday={isToday} />
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {!isPending && !isError && <AddHabit existing={habits} />}
        </Card>

        <GoalTaskList
          goal={goal}
          title="할 일"
          hint="병원 가기 · 친구 만나기처럼 한 번만 할 일이에요. 날짜만 정하면 캘린더 빈 시간에 넣어 드려요."
          addLabel="할 일 추가"
          emptyText="아직 할 일이 없어요. 위에서 바로 추가해 보세요."
          initialPeriod="ALL"
        />
      </div>

      {!isPending && !isError && (
        <div className="mt-5">
          <HabitHeatmap habits={habits} today={today} />
        </div>
      )}
    </>
  )
}
