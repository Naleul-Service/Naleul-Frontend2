'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { dayLabel } from '@/features/work/format'
import { hexOf } from '@/features/timetable/layout'
import { hm } from '@/features/timetable/time'
import type { TimeBlockTask, TimetableDay } from '@/features/timetable/types'
import type { DeadlineType, HomeDeadline } from '../api'
import { isRoutineTask, startMinutes, tasksOfDay } from '../today'

const MAX_PER_DAY = 4

/**
 * 다가오는 일정 — 내일부터 6일 동안 시간이 정해진 일 (루틴은 매일 반복이라 빼요).
 * 약속(APPOINTMENT)은 강조해요.
 */
export function UpcomingSchedule({ days, today }: { days: TimetableDay[]; today: string }) {
  const groups = days
    .map((d) => ({
      date: d.date,
      items: tasksOfDay(d)
        .filter((t) => !isRoutineTask(t) && t.taskStatus === 'TODO')
        .sort((a, b) => startMinutes(d.date, a) - startMinutes(d.date, b)),
    }))
    .filter((g) => g.items.length > 0)

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-bold">다가오는 일정</h2>
        <span className="text-ink-3 text-[13px]">앞으로 6일</span>
      </div>
      {groups.length === 0 ? (
        <p className="text-ink-3 py-4 text-sm">이번 주에 잡힌 일정이 없어요.</p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <section key={g.date}>
              <Link
                href={`/calendar?view=day&date=${g.date}`}
                className="text-ink-2 hover:text-ink mb-1 inline-block text-[13px] font-bold"
              >
                {dayLabel(g.date, today)}
                <span className="text-ink-4 ml-1 font-semibold">{g.items.length}개</span>
              </Link>
              <ul>
                {g.items.slice(0, MAX_PER_DAY).map((t) => (
                  <ScheduleRow key={t.taskId} t={t} />
                ))}
              </ul>
              {g.items.length > MAX_PER_DAY && (
                <p className="text-ink-4 pl-[54px] text-[12px]">+{g.items.length - MAX_PER_DAY}개 더</p>
              )}
            </section>
          ))}
        </div>
      )}
    </Card>
  )
}

function ScheduleRow({ t }: { t: TimeBlockTask }) {
  const appointment = t.taskKind === 'APPOINTMENT'
  return (
    <li className="flex items-center gap-2 py-1">
      <span className="text-ink-3 w-[46px] shrink-0 text-[12px] tabular-nums">
        {t.plannedStartAt ? hm(t.plannedStartAt) : '미정'}
      </span>
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: hexOf(t.goalColorCode) }} aria-hidden />
      <span className={cn('min-w-0 flex-1 truncate text-[14px]', appointment && 'font-semibold')}>
        {t.emoji ? `${t.emoji} ` : ''}
        {t.taskName}
      </span>
      {appointment && (
        <span className="bg-brand-soft text-brand shrink-0 rounded px-1.5 text-[10px] font-bold">약속</span>
      )}
    </li>
  )
}

const TYPE_LABEL: Record<DeadlineType, string> = { TASK: 'Task', TOPIC: '주제', GOAL: '목표 마감' }

function ddayText(d: HomeDeadline) {
  if (d.dDay === 0) return '오늘'
  if (d.dDay === 1) return '내일'
  return d.dDay < 0 ? `${-d.dDay}일 지남` : `D-${d.dDay}`
}

/** 다가오는 마감 — Task 마감 · 업무형 주제 마감 · 목표형 종료일 (지난 7일 ~ 앞으로 14 · 30일) */
export function UpcomingDeadlines({
  deadlines,
  today,
  failed,
}: {
  deadlines: HomeDeadline[] | undefined
  today: string
  failed: boolean
}) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-bold">다가오는 마감</h2>
        {deadlines && deadlines.length > 0 && (
          <span className="text-ink-3 text-[13px]">{deadlines.filter((d) => !d.overdue).length}개</span>
        )}
      </div>
      {failed ? (
        <p className="text-ink-3 py-4 text-sm">마감을 불러오지 못했어요.</p>
      ) : !deadlines ? (
        <div className="bg-subtle h-24 animate-pulse rounded-xl" />
      ) : deadlines.length === 0 ? (
        <p className="text-ink-3 py-4 text-sm">2주 안에 다가오는 마감이 없어요.</p>
      ) : (
        <ul className="divide-line -my-1 divide-y">
          {deadlines.map((d) => (
            <li key={`${d.type}-${d.id}`}>
              <Link
                href={d.goalCategoryId ? `/goal/${d.goalCategoryId}` : `/calendar?view=day&date=${d.date}`}
                className="hover:bg-subtle/60 -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5"
              >
                <span
                  className={cn(
                    'grid h-9 w-14 shrink-0 place-items-center rounded-lg text-[12px] font-bold tabular-nums',
                    d.overdue
                      ? 'bg-danger-soft text-danger'
                      : d.dDay <= 2
                        ? 'bg-warning-soft text-warning-ink'
                        : 'bg-subtle text-ink-2'
                  )}
                >
                  {ddayText(d)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">
                    {d.emoji ? `${d.emoji} ` : ''}
                    {d.title}
                  </span>
                  <span className="text-ink-3 flex items-center gap-1.5 text-[12px]">
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: hexOf(d.colorCode) }}
                      aria-hidden
                    />
                    <span className="truncate">
                      {TYPE_LABEL[d.type]} · {dayLabel(d.date, today)}
                      {d.type !== 'GOAL' && d.goalName ? ` · ${d.goalName}` : ''}
                      {d.type === 'TOPIC' && d.remaining ? ` · 남은 ${d.remaining}개` : ''}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
