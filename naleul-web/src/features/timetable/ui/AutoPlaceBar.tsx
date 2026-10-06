'use client'

import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { useFillTimetable } from '../api'
import type { TimetableDay } from '../types'

/** 배치 대상: 오늘 이후 날짜의 "시간 미정" 미완료 Task (미션은 방장이 시간을 정하므로 제외) */
export function unplacedOf(days: TimetableDay[], today: string) {
  return days
    .filter((d) => d.date >= today)
    .map((d) => ({
      date: d.date,
      count: d.unscheduledTasks.filter((t) => t.taskStatus === 'TODO' && t.sourceType !== 'MISSION').length,
    }))
    .filter((d) => d.count > 0)
}

/**
 * 캘린더 위 "AI로 TimeTable 배치하기" 띠.
 * 시간 미정 Task 가 있을 때만 버튼이 켜져요. 직접 정한 시간(🔒)과 고정 시간은 그대로 두고 남은 빈 시간에 넣어요.
 */
export function AutoPlaceBar({ days, today }: { days: TimetableDay[]; today: string }) {
  const fill = useFillTimetable()
  const targets = unplacedOf(days, today)
  const total = targets.reduce((n, d) => n + d.count, 0)
  const onlyToday = targets.length === 1 && targets[0].date === today
  const active = total > 0

  return (
    <div
      className={cn(
        'mb-3 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3',
        active ? 'border-brand/25 bg-brand-soft/60' : 'border-line bg-surface'
      )}
    >
      <span
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-xl',
          active ? 'bg-brand text-white' : 'bg-subtle text-ink-4'
        )}
      >
        <Sparkles className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('text-[14px] font-bold', !active && 'text-ink-3')}>
          {active ? `아직 시간이 정해지지 않은 Task가 ${total}개 있어요` : '모든 Task가 TimeTable에 배치돼 있어요'}
        </p>
        <p className="text-ink-3 text-xs leading-relaxed">
          직접 정한 시간(🔒)과 고정 시간은 그대로 두고, 남은 빈 시간에 집중이 잘 되는 시간대부터 넣어요.
          {targets.some((d) => d.date === today) && ' 오늘은 지금 이후 시간만 써요.'}
        </p>
      </div>
      <Button
        variant={active ? 'brand' : 'secondary'}
        size="sm"
        disabled={!active}
        loading={fill.isPending}
        title={active ? undefined : '배치할 시간 미정 Task가 없어요'}
        onClick={() => fill.mutate({ startDate: targets[0].date, endDate: targets[targets.length - 1].date })}
      >
        <Sparkles className="size-3.5" />
        {onlyToday || !active ? 'AI로 오늘 TimeTable 배치하기' : `AI로 TimeTable 배치하기 (${targets.length}일)`}
      </Button>
    </div>
  )
}
