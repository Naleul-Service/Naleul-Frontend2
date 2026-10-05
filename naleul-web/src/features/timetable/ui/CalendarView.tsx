'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { useTimetable } from '../api'
import { visibleHours } from '../layout'
import { addDays, addMonths, formatRange, isYmd, startOfWeek, todayKst } from '../time'
import { HATCH } from './Blocks'
import { MonthView } from './MonthView'
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
  const { days, selection, onSelectTask, onSelectFixed, onDrop, close, toggleComplete, overlays } =
    useTimetableInteractions(rawDays, date)
  const { startHour, endHour } = useMemo(() => visibleHours(days), [days])

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
        description="블록을 눌러 배치 이유를 보고, 끌어서 시간을 바꿔요. 직접 옮긴 블록은 잠겨요."
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
        <TimeGrid
          days={days}
          startHour={startHour}
          endHour={endHour}
          selection={selection}
          onSelectTask={onSelectTask}
          onSelectFixed={onSelectFixed}
          onDrop={onDrop}
          onDragStart={close}
          onDayClick={(d) => {
            close()
            go({ view: 'day', date: d })
          }}
        />
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
    </ul>
  )
}
