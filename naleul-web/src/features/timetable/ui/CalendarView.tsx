'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { rectOf } from '@/components/ui/Popover'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { useActivities, useTimetable } from '../api'
import { visibleHours } from '../layout'
import { addDays, addMonths, formatRange, isYmd, nowKst, startOfWeek, todayKst } from '../time'
import { HATCH } from './Blocks'
import { MonthView } from './MonthView'
import { AutoPlaceBar } from './AutoPlaceBar'
import { TimeGrid } from './TimeGrid'
import { useTimetableInteractions } from './useTimetableInteractions'

export type CalendarMode = 'day' | 'week' | 'month'

/** URL(?view=week&date=2026-11-18) ↔ 화면 상태 */
function useCalendarParams() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const rawView = params.get('view')
  const view: CalendarMode = rawView === 'day' || rawView === 'month' ? rawView : 'week'
  const rawDate = params.get('date')
  const date = isYmd(rawDate) ? rawDate : todayKst()

  const go = useCallback(
    (next: { view?: CalendarMode; date?: string }) => {
      const q = new URLSearchParams(params.toString())
      q.set('view', next.view ?? view)
      q.set('date', next.date ?? date)
      router.replace(`${pathname}?${q.toString()}`, { scroll: false })
    },
    [params, router, pathname, view, date]
  )
  return { view, date, go }
}

export function CalendarView() {
  const { view, date, go } = useCalendarParams()
  // 월간은 오른쪽 패널에 보여줄 "선택한 날" 하루만 불러와요 (달 전체 요약은 MonthView 가 따로)
  const start = view === 'week' ? startOfWeek(date) : date
  const end = view === 'week' ? addDays(start, 6) : date
  const { data, isPending, isError, error, refetch, isFetching } = useTimetable(start, end)

  // 표시 중인 데이터가 지금 보는 기간의 것인지 (placeholderData 로 이전 주가 잠깐 보일 수 있음)
  const rawDays = useMemo(() => (data?.days ?? []).filter((d) => d.date >= start && d.date <= end), [data, start, end])
  // 실제로 한 일 (월간은 시간 격자가 없어서 안 불러요)
  const activities = useActivities(start, end, view !== 'month')
  const acts = useMemo(() => activities.data ?? [], [activities.data])
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
    toggleComplete,
    overlays,
  } = useTimetableInteractions(rawDays, date)
  const { startHour, endHour } = useMemo(() => visibleHours(days, acts), [days, acts])

  // ── 이동 ──
  const move = (n: number) => {
    close()
    go({ date: view === 'month' ? addMonths(date, n) : addDays(date, n * (view === 'week' ? 7 : 1)) })
  }
  const unit = view === 'month' ? '달' : view === 'week' ? '주' : '날'

  const today = todayKst()
  return (
    <>
      <PageHeader
        title="캘린더"
        description="블록을 눌러 배치 이유를 보고, 끌어서 시간을 바꿔요. 지난 빈 시간을 누르면 실제로 한 일을 남길 수 있어요."
        actions={
          <div className="bg-subtle flex rounded-xl p-1" role="tablist" aria-label="보기">
            {(
              [
                ['day', '일간'],
                ['week', '주간'],
                ['month', '월간'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => {
                  close()
                  go({ view: v })
                }}
                className={cn(
                  'h-8 rounded-lg px-3.5 text-[13px] font-semibold transition-colors',
                  view === v ? 'bg-surface text-ink shadow-card' : 'text-ink-3 hover:text-ink'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      {/* 기간 이동 */}
      <div className="mt-5 mb-3 flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => go({ date: today })}
          disabled={view === 'month' ? date === today : start <= today && today <= end}
        >
          오늘
        </Button>
        <div className="flex">
          <button
            type="button"
            onClick={() => move(-1)}
            aria-label={`이전 ${unit}`}
            className="text-ink-2 hover:bg-subtle rounded-lg p-1.5"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            aria-label={`다음 ${unit}`}
            className="text-ink-2 hover:bg-subtle rounded-lg p-1.5"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
        <h2 className="text-[17px] font-bold" aria-live="polite">
          {view === 'month'
            ? `${date.slice(0, 4)}년 ${Number(date.slice(5, 7))}월`
            : view === 'week'
              ? formatRange(start, end)
              : formatRange(date, date)}
        </h2>
        {isFetching && !isPending && <Spinner className="text-ink-4 size-3.5" />}
        {view !== 'month' && <Legend />}
        {view !== 'month' && (
          <Button
            variant="secondary"
            size="sm"
            className="max-md:ml-auto"
            onClick={(e) => {
              // 오늘(또는 보고 있는 지난 날)의 최근 1시간으로 열어요
              const now = nowKst()
              const day = view === 'day' && date < today ? date : today
              const endMin = day === today ? Math.floor(now.minutes / 10) * 10 : 13 * 60
              openActivity({ date: day, start: Math.max(endMin - 60, 0), end: endMin }, rectOf(e.currentTarget))
            }}
          >
            <Plus className="size-4" />
            실제로 한 일
          </Button>
        )}
      </div>

      {view === 'month' ? (
        <MonthView
          date={date}
          today={today}
          dayDetail={days.find((d) => d.date === date)}
          dayLoading={isFetching}
          onSelectDate={(d) => {
            close()
            go({ date: d })
          }}
          onOpenDay={(d) => {
            close()
            go({ view: 'day', date: d })
          }}
          onSelectTask={onSelectTask}
          onToggleComplete={(t) => toggleComplete.mutate(t)}
          togglingId={toggleComplete.isPending ? (toggleComplete.variables?.taskId ?? null) : null}
        />
      ) : isPending ? (
        <Card className="grid min-h-[420px] place-items-center">
          <Spinner className="text-ink-3 size-6" />
        </Card>
      ) : isError && !days.length ? (
        <Card className="grid min-h-[320px] place-items-center p-8 text-center">
          <div>
            <p className="font-bold">TimeTable을 불러오지 못했어요</p>
            <p className="text-ink-3 mt-1 text-sm">{error instanceof Error ? error.message : ''}</p>
            <Button variant="secondary" className="mt-4" onClick={() => refetch()}>
              다시 시도
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <AutoPlaceBar days={rawDays} today={today} />
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
            onDayClick={(d) => {
              close()
              go({ view: 'day', date: d })
            }}
          />
        </>
      )}

      {overlays}
    </>
  )
}

function Legend() {
  const item = 'flex items-center gap-1.5'
  return (
    <ul className="text-ink-3 ml-auto hidden flex-wrap items-center gap-x-3 gap-y-1 text-xs md:flex" aria-label="범례">
      <li className={item}>
        <span className="bg-brand size-2.5 rounded-sm" />
        Task
      </li>
      <li className={item}>
        <span className="border-brand bg-brand-soft size-2.5 rounded-sm border-l-2" />
        루틴
      </li>
      <li className={item}>
        <span className="border-line-strong size-2.5 rounded-sm border" style={HATCH} />
        고정 시간
      </li>
      <li className={item}>🔒 직접 정한 시간</li>
      <li className={item}>
        <span className="border-success border-line bg-surface size-2.5 rounded-sm border border-l-2" />
        실제로 한 일
      </li>
    </ul>
  )
}
