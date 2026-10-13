'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { CalendarDays, Plus } from 'lucide-react'
import { rectOf } from '@/components/ui/Popover'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { useActivities } from '@/features/timetable/api'
import { visibleHours } from '@/features/timetable/layout'
import { nowKst } from '@/features/timetable/time'
import type { TimetableDay } from '@/features/timetable/types'
import { TimeGrid } from '@/features/timetable/ui/TimeGrid'
import { useTimetableInteractions } from '@/features/timetable/ui/useTimetableInteractions'

/**
 * 홈의 오늘 일간 캘린더 — 캘린더 화면의 일간 보기(계획 | 실제)를 그대로 넣었어요.
 * 블록을 눌러 상세 · 완료, 끌어서 시간 바꾸기, 지난 빈 시간을 눌러 실제로 한 일 남기기까지 똑같이 돼요.
 */
export function HomeDayCalendar({ day, className }: { day: TimetableDay; className?: string }) {
  const activities = useActivities(day.date, day.date)
  const acts = useMemo(() => activities.data ?? [], [activities.data])
  const rawDays = useMemo(() => [day], [day])
  const {
    days,
    selection,
    onSelectTask,
    onSelectFixed,
    onSelectActivity,
    onEmptyClick,
    openActivity,
    onDrop,
    close,
    overlays,
    groupIds,
    focusIds,
    fadeOthers,
  } = useTimetableInteractions(rawDays, day.date)
  const { startHour, endHour } = useMemo(() => visibleHours(days, acts), [days, acts])

  return (
    <Card className={cn('flex min-h-0 flex-col overflow-hidden p-0', className)}>
      <div className="flex shrink-0 flex-wrap items-center gap-1 px-4 pt-4 pb-2 sm:px-5">
        <h2 className="text-[17px] font-bold">오늘 일정</h2>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              const endMin = Math.floor(nowKst().minutes / 10) * 10
              openActivity({ date: day.date, start: Math.max(endMin - 60, 0), end: endMin }, rectOf(e.currentTarget))
            }}
          >
            <Plus className="size-4" />한 일
          </Button>
          <Link
            href={`/calendar?view=day&date=${day.date}`}
            className="text-ink-3 hover:text-ink hover:bg-subtle flex h-8 items-center gap-1 rounded-lg px-2.5 text-[13px] font-semibold"
          >
            <CalendarDays className="size-4" />
            캘린더
          </Link>
        </div>
      </div>
      <div className="min-h-0 flex-1 px-2 pb-2 sm:px-3 sm:pb-3">
        <TimeGrid
          days={days}
          startHour={startHour}
          endHour={endHour}
          selection={selection}
          onSelectTask={onSelectTask}
          onSelectFixed={onSelectFixed}
          activities={acts}
          onSelectActivity={onSelectActivity}
          onEmptyClick={onEmptyClick}
          onDrop={onDrop}
          onDragStart={close}
          groupIds={groupIds}
          focusIds={focusIds}
          fadeOthers={fadeOthers}
          // 넓은 화면: 칸 높이를 꽉 채우고 안에서 스크롤 (지금 시각 근처로 열려요) · 좁은 화면: 520px
          maxHeightClass="max-h-[520px] lg:max-h-none lg:h-full"
          planVsActual
        />
      </div>
      {overlays}
    </Card>
  )
}
