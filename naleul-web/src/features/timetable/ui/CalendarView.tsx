'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { rectOf } from '@/components/ui/Popover'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { segmentClass, segmentedClass } from '@/components/ui/SegmentedTabs'
import { TaskAddPanel } from '@/features/brain-dump/ui/TaskAddPanel'
import { track } from '@/lib/client/analytics'
import { dateRelationOf, errorStatusOf } from '@/features/home/analytics'
import { useActivities, useTimetable } from '../api'
import { visibleHours } from '../layout'
import { addDays, addMonths, formatRange, isYmd, nowKst, startOfWeek, todayKst } from '../time'
import { HATCH } from './Blocks'
import { MonthView } from './MonthView'
import { AutoPlaceBar } from './AutoPlaceBar'
import { ScheduleAiBar } from './ScheduleAiBar'
import { DayTaskList } from './DayTaskList'
import { TimeGrid } from './TimeGrid'
import { useTimetableInteractions } from './useTimetableInteractions'

export type CalendarMode = 'day' | 'week' | 'month'
type AddMode = 'ai' | 'manual' | 'log'

/** URL(?view=week&date=2026-11-18) ↔ 화면 상태 */
function useCalendarParams() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const rawView = params.get('view')
  const view: CalendarMode = rawView === 'day' || rawView === 'month' ? rawView : 'week'
  const rawDate = params.get('date')
  const date = isYmd(rawDate) ? rawDate : todayKst()
  // ?add=ai|manual|log → 오른쪽 Task 추가 패널 (사이드바 "Task 추가"가 여기로 와요)
  const rawAdd = params.get('add')
  const add: AddMode | null = rawAdd === 'ai' || rawAdd === 'manual' || rawAdd === 'log' ? rawAdd : rawAdd ? 'ai' : null

  const go = useCallback(
    (next: { view?: CalendarMode; date?: string; add?: AddMode | null }) => {
      const q = new URLSearchParams(params.toString())
      q.set('view', next.view ?? view)
      q.set('date', next.date ?? date)
      const nextAdd = next.add === undefined ? add : next.add
      if (nextAdd) q.set('add', nextAdd)
      else q.delete('add')
      router.replace(`${pathname}?${q.toString()}`, { scroll: false })
    },
    [params, router, pathname, view, date, add]
  )
  return { view, date, add, go }
}

export function CalendarView() {
  const { view, date, add, go } = useCalendarParams()
  // 패널에서 방금 추가한 Task — 캘린더에 NEW 로 표시
  const [newIds, setNewIds] = useState<ReadonlySet<number>>(new Set())
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
    groupIds,
    previewFill,
    fillPreviewing,
    proposing,
    focusIds,
    fadeOthers,
    gridEvents,
  } = useTimetableInteractions(rawDays, date, { sidePanel: !!add, surface: 'calendar' })
  const { startHour, endHour } = useMemo(() => visibleHours(days, acts), [days, acts])

  // ── 이동 ──
  const move = (n: number) => {
    close()
    const next = view === 'month' ? addMonths(date, n) : addDays(date, n * (view === 'week' ? 7 : 1))
    track('calendar.date_nav_click', {
      view_mode: view,
      date_action: n < 0 ? 'prev' : 'next',
      view_date: next,
      date_relation: dateRelationOf(next),
    })
    go({ date: next })
  }
  const unit = view === 'month' ? '달' : view === 'week' ? '주' : '날'

  const today = todayKst()

  // calendar.pageview — 처음 그려진 직후 한 번만 (보기·날짜가 바뀌어도 다시 안 보냄)
  const pageviewSent = useRef(false)
  useEffect(() => {
    if (pageviewSent.current) return
    pageviewSent.current = true
    track('calendar.pageview', {
      view_mode: view,
      view_date: date,
      date_relation: dateRelationOf(date),
      add_mode: add ?? undefined,
    })
  }, [view, date, add])

  // calendar.load_fail — 일간·주간에서 실패 카드가 보이게 될 때 한 번
  const loadFailed = view !== 'month' && !isPending && isError && !days.length
  const errorStatus = errorStatusOf(error)
  const loadFailSent = useRef(false)
  useEffect(() => {
    if (!loadFailed) {
      loadFailSent.current = false
      return
    }
    if (loadFailSent.current) return
    loadFailSent.current = true
    track('calendar.load_fail', { view_mode: view, view_date: date, error_status: errorStatus })
  }, [loadFailed, view, date, errorStatus])

  return (
    // 패널이 열려 있으면 xl 이상에서는 캘린더가 패널 폭만큼 비켜서 나란히 보여요
    <div className={cn(add && 'xl:pr-[420px]')}>
      <PageHeader
        title="캘린더"
        description="블록을 눌러 배치 이유를 보고, 끌어서 시간을 바꿔요. 지난 빈 시간을 누르면 실제로 한 일을 남길 수 있어요."
        actions={
          <div className="flex items-center gap-2">
            {!add && (
              <Button
                size="sm"
                onClick={() => {
                  track('calendar.task_add_click', { view_mode: view, view_date: date })
                  go({ add: 'ai', view: view === 'month' ? 'week' : view })
                }}
              >
                <Plus className="size-4" />
                Task 추가
              </Button>
            )}
            <div className={segmentedClass()} role="tablist" aria-label="보기">
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
                    if (v !== view) track('calendar.view_change', { view_mode: v, from_view: view, view_date: date })
                    close()
                    go({ view: v })
                  }}
                  className={segmentClass(view === v)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {/* 기간 이동 */}
      <div className="mt-5 mb-3 flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            track('calendar.date_nav_click', {
              view_mode: view,
              date_action: 'today',
              view_date: today,
              date_relation: 'today',
            })
            go({ date: today })
          }}
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
              track('calendar.activity_add_click', { view_mode: view, date_relation: dateRelationOf(day) })
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
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => {
                track('calendar.retry_click', { view_mode: view, error_status: errorStatus })
                refetch()
              }}
            >
              다시 시도
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* 여러 목표의 루틴 · 일정을 한 문장으로 옮기기 (보고 있는 주/날 기준) */}
          <ScheduleAiBar startDate={start} endDate={end} viewMode={view} />
          <AutoPlaceBar
            days={rawDays}
            today={today}
            onPreview={previewFill}
            loading={fillPreviewing}
            proposing={proposing}
            viewMode={view}
          />
          {/* 일간: TimeTable(계획 | 실제) 오른쪽에 그날 할 일 목록 — Task 추가 패널이 열려 있으면 자리가 좁아 숨겨요 */}
          <div className={cn(view === 'day' && !add && 'grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]')}>
            <TimeGrid
              {...gridEvents}
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
              highlightIds={newIds}
              focusIds={focusIds}
              fadeOthers={fadeOthers}
              onDayClick={(d) => {
                track('calendar.day_header_click', { view_date: d, date_relation: dateRelationOf(d) })
                close()
                go({ view: 'day', date: d })
              }}
              planVsActual={view === 'day'}
            />
            {view === 'day' && !add && (
              <div className="lg:sticky lg:top-4">
                <DayTaskList
                  day={days.find((d) => d.date === date)}
                  today={today}
                  onSelect={onSelectTask}
                  onToggle={(t) => toggleComplete.mutate(t)}
                  togglingId={toggleComplete.isPending ? (toggleComplete.variables?.taskId ?? null) : null}
                />
              </div>
            )}
          </div>
        </>
      )}

      {overlays}

      {add && (
        <TaskAddPanel
          mode={add}
          onClose={() => go({ add: null })}
          onAdded={(info) => {
            setNewIds((prev) => new Set([...prev, ...info.taskIds]))
            const inView = (d: string) => d >= start && d <= end
            // AI로 정리한 Task 는 바로 놓지 않고 점선으로 먼저 보여 줘요 → 아래 바에서 "이대로 진행할까요?"
            if (info.pendingTaskIds?.length) {
              const pendingCount = info.pendingTaskIds.length
              // Esc 로 취소하면 final 이 비어 와서, 받은 제안 수를 따로 기억해요 (task_add_result.proposal_resolve)
              let unscheduledCount = 0
              const surface = 'calendar_panel'
              previewFill(
                { taskIds: info.pendingTaskIds },
                {
                  kind: 'new',
                  onPreview: (r) => {
                    unscheduledCount = r.unscheduled.length
                    track('task_add_result.proposal_ready', {
                      surface,
                      result: 'success',
                      placed_count: r.proposals.length,
                      unscheduled_count: r.unscheduled.length,
                    })
                    const first = r.proposals.map((p) => p.date).sort()[0] ?? info.date
                    if (first && !inView(first)) go({ date: first })
                  },
                  onResolve: (applied, final) => {
                    track('task_add_result.proposal_resolve', {
                      surface,
                      proposal_applied: applied,
                      dragged_count: final.filter((p) => p.start !== p.proposedStart || p.end !== p.proposedEnd).length,
                      placed_count: applied ? final.length : 0,
                      unscheduled_count: applied ? unscheduledCount : pendingCount,
                    })
                  },
                  onError: () =>
                    track('task_add_result.proposal_ready', {
                      surface,
                      result: 'fail',
                      placed_count: 0,
                      unscheduled_count: pendingCount,
                    }),
                }
              )
              return
            }
            // 추가한 날이 지금 보는 기간 밖이면 그 주(날)로 옮겨요
            if (info.date && !inView(info.date)) go({ date: info.date })
          }}
        />
      )}
    </div>
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
      <li className={item}>📌 직접 정한 시간</li>
      <li className={item}>
        <span className="border-success border-line bg-surface size-2.5 rounded-sm border border-l-2" />
        실제로 한 일
      </li>
    </ul>
  )
}
