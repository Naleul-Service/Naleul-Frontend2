'use client'

import Link from 'next/link'
import { CalendarDays, Coffee, Moon, Sunrise } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { hexOf } from '@/features/timetable/layout'
import { formatMinutes, minutesFrom } from '@/features/timetable/time'
import type { TimeBlockTask, TimetableDay } from '@/features/timetable/types'
import { agendaOf, isDone, type AgendaItem } from '../today'
import { TaskCheck } from './TaskCheck'

/**
 * 오늘 일정표 — 시간이 정해진 Task 와 고정 시간(점심 · 저녁 등)을 시간순으로.
 * 지금 시각 줄을 끼워 넣어 "지금 뭐 할 차례지?"가 바로 보이게 해요. 지난 일은 흐리게.
 */
export function TodayAgenda({
  day,
  now,
  onToggle,
  togglingId,
}: {
  day: TimetableDay
  now: number
  onToggle: (t: TimeBlockTask) => void
  togglingId: number | null
}) {
  const items = agendaOf(day)
  const wake = day.sleep?.wake ? minutesFrom(day.date, day.sleep.wake.end) : null
  const bed = day.sleep?.bed ? minutesFrom(day.date, day.sleep.bed.start) : null
  // 지금 줄은 "아직 시작 안 한 첫 일정" 앞에 (지금 하는 일은 줄 위에 강조)
  const nowAt = items.findIndex((it) => it.start > now)
  const nowIndex = nowAt === -1 ? items.length : nowAt

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-bold">오늘 일정</h2>
        <Link
          href={`/calendar?view=day&date=${day.date}`}
          className="text-ink-3 hover:text-ink flex items-center gap-1 text-[13px] font-semibold"
        >
          <CalendarDays className="size-4" />
          캘린더
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-ink-3 py-6 text-center text-sm">
          시간을 정한 일정이 없어요.
          <br />
          캘린더에서 할 일을 시간에 끌어다 놓으면 여기 보여요.
        </p>
      ) : (
        <ol className="relative">
          {wake !== null && (
            <Edge icon={<Sunrise className="size-3.5" />} time={wake} label="기상" past={now >= wake} />
          )}
          {items.map((it, i) => (
            <li key={it.key} className="contents">
              {i === nowIndex && <NowLine now={now} />}
              <Row item={it} now={now} onToggle={onToggle} busy={it.kind === 'task' && togglingId === it.task.taskId} />
            </li>
          ))}
          {nowIndex === items.length && (bed === null || now < bed) && <NowLine now={now} />}
          {bed !== null && <Edge icon={<Moon className="size-3.5" />} time={bed} label="취침" past={now >= bed} />}
        </ol>
      )}
    </Card>
  )
}

const TIME_COL = 'w-[46px] shrink-0 text-right text-[12px] tabular-nums'

function Row({
  item,
  now,
  onToggle,
  busy,
}: {
  item: AgendaItem
  now: number
  onToggle: (t: TimeBlockTask) => void
  busy: boolean
}) {
  const past = item.end <= now
  const current = item.start <= now && now < item.end

  if (item.kind === 'fixed') {
    const b = item.block
    return (
      <div className={cn('flex items-center gap-3 py-1.5', past && 'opacity-50')}>
        <span className={cn(TIME_COL, 'text-ink-4')}>{formatMinutes(item.start)}</span>
        <span className="grid size-6 shrink-0 place-items-center">
          <Coffee className="text-ink-4 size-3.5" />
        </span>
        <span className="text-ink-3 min-w-0 flex-1 truncate text-[13px]">
          {b.emoji ? `${b.emoji} ` : ''}
          {b.title}
          <span className="text-ink-4"> · ~{formatMinutes(item.end)}</span>
        </span>
      </div>
    )
  }

  const t = item.task
  const done = isDone(t)
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl py-2',
        current && !done && 'bg-brand-soft -mx-2 px-2',
        past && !current && (done ? 'opacity-55' : '')
      )}
    >
      <span className={cn(TIME_COL, current ? 'text-brand font-bold' : 'text-ink-2 font-semibold')}>
        {formatMinutes(item.start)}
      </span>
      <TaskCheck
        done={done}
        label={t.taskName}
        onToggle={() => onToggle(t)}
        disabled={busy || t.sourceType === 'MISSION'}
      />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-[14px] font-semibold', done && 'text-ink-3 line-through')}>
          {t.emoji ? `${t.emoji} ` : ''}
          {t.taskName}
        </p>
        <p className="text-ink-3 flex items-center gap-1.5 text-[12px]">
          <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: hexOf(t.goalColorCode) }} />
          <span className="truncate">
            ~{formatMinutes(item.end)}
            {t.goalCategoryName && !t.goalTemporary ? ` · ${t.goalCategoryName}` : ''}
            {t.sourceType === 'ROUTINE' ? ' · 루틴' : ''}
            {t.taskKind === 'APPOINTMENT' ? ' · 약속' : ''}
          </span>
        </p>
      </div>
      {current && !done && <span className="text-brand shrink-0 text-[11px] font-bold">지금</span>}
      {past && !done && !current && (
        <span className="bg-danger-soft text-danger shrink-0 rounded px-1.5 text-[10px] font-bold">지남</span>
      )}
    </div>
  )
}

function NowLine({ now }: { now: number }) {
  return (
    <div className="my-1 flex items-center gap-3" aria-label={`지금 ${formatMinutes(now)}`}>
      <span className={cn(TIME_COL, 'text-danger font-bold')}>{formatMinutes(now)}</span>
      <span className="grid size-6 shrink-0 place-items-center">
        <span className="bg-danger size-2 rounded-full" />
      </span>
      <span className="bg-danger/60 h-px flex-1" />
    </div>
  )
}

function Edge({ icon, time, label, past }: { icon: React.ReactNode; time: number; label: string; past: boolean }) {
  return (
    <div className={cn('text-ink-3 flex items-center gap-3 py-1.5 text-[12px]', past && 'opacity-60')}>
      <span className={cn(TIME_COL, 'text-ink-4')}>{formatMinutes(time)}</span>
      <span className="grid size-6 shrink-0 place-items-center">{icon}</span>
      <span>{label}</span>
    </div>
  )
}
