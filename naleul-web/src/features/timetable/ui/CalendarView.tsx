'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CalendarClock, ChevronLeft, ChevronRight, NotebookPen, Plus, Sparkles, SquarePen } from '@/components/icons'
import { rectOf, type AnchorRect } from '@/components/ui/Popover'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { segmentClass, segmentedClass } from '@/components/ui/SegmentedTabs'
import { iconButtonClass } from '@/components/ui/IconButton'
import { TaskAddPanel } from '@/features/brain-dump/ui/TaskAddPanel'
import { track } from '@/lib/client/analytics'
import { dateRelationOf, errorStatusOf } from '@/features/home/analytics'
import { useActivities, useTimetable } from '../api'
import { visibleHours } from '../layout'
import { addDays, addMonths, formatRange, isYmd, nowKst, startOfWeek, todayKst } from '../time'
import { HATCH } from './Blocks'
import { MonthView } from './MonthView'
import { ActionMenu } from './ActionMenu'
import { ADD_MODE_LABEL } from '@/features/brain-dump/ui/TaskAddPanel'
import { AutoPlaceBar, unplacedOf } from './AutoPlaceBar'
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
  // + 메뉴 · AI 메뉴 (명세 11) — slot 이 있으면 빈 곳을 눌러 연 것 (그 날짜 · 시각을 미리 채워요)
  const [menu, setMenu] = useState<{
    kind: 'add' | 'ai'
    anchor: AnchorRect
    slot?: { date: string; minutes: number }
  } | null>(null)
  // 계획 할 일 추가 패널에 미리 채울 날짜 · 시각
  const [prefill, setPrefill] = useState<{ date: string; startTime: string; endTime: string } | undefined>()
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
  } = useTimetableInteractions(rawDays, date, {
    sidePanel: !!add,
    surface: 'calendar',
    onEmptyMenu: (slot, anchor) => setMenu({ kind: 'add', anchor, slot }),
  })
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

  // ── + 메뉴 (명세 11.2) — AI로 자동 Task 추가 · 계획 할 일 추가 · 실제 한 일 추가 ──
  const pad = (n: number) => String(n).padStart(2, '0')
  const hhmm = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`
  const addMenuItems = (slot: { date: string; minutes: number } | undefined, anchor: AnchorRect) => {
    // 자정 뒤 칸(24:00~)은 다음 날
    const at = slot && slot.minutes >= 1440 ? { date: addDays(slot.date, 1), minutes: slot.minutes - 1440 } : slot
    const nowMin = nowKst().minutes
    const future = !!at && (at.date > today || (at.date === today && at.minutes >= nowMin))
    const panelView = view === 'month' ? 'week' : view
    return [
      {
        key: 'ai',
        label: ADD_MODE_LABEL.ai,
        icon: <Sparkles />,
        onSelect: () => {
          track('calendar.task_add_click', { view_mode: view, view_date: at?.date ?? date, add_mode: 'ai' })
          setPrefill(undefined)
          go({ add: 'ai', view: panelView, ...(at ? { date: at.date } : {}) })
        },
      },
      {
        key: 'manual',
        label: ADD_MODE_LABEL.manual,
        icon: <SquarePen />,
        onSelect: () => {
          track('calendar.task_add_click', { view_mode: view, view_date: at?.date ?? date, add_mode: 'manual' })
          setPrefill(
            at
              ? { date: at.date, startTime: hhmm(at.minutes), endTime: hhmm(Math.min(at.minutes + 60, 1439)) }
              : undefined
          )
          go({ add: 'manual', view: panelView })
        },
      },
      {
        key: 'log',
        label: ADD_MODE_LABEL.log,
        icon: <NotebookPen />,
        disabled: future,
        hint: future ? '지난 시간만 남길 수 있어요' : undefined,
        onSelect: () => {
          if (at) {
            track('calendar.activity_add_click', {
              view_mode: view,
              date_relation: dateRelationOf(at.date),
            })
            openActivity({ date: at.date, start: at.minutes, end: at.minutes + 60 }, anchor)
            return
          }
          // 머리글에서 열면 예전 "실제로 한 일" 버튼처럼 오늘(또는 보고 있는 지난 날)의 최근 1시간
          const now = nowKst()
          const day = view === 'day' && date < today ? date : today
          const endMin = day === today ? Math.floor(now.minutes / 10) * 10 : 13 * 60
          track('calendar.activity_add_click', { view_mode: view, date_relation: dateRelationOf(day) })
          openActivity({ date: day, start: Math.max(endMin - 60, 0), end: endMin }, anchor)
        },
      },
    ]
  }

  // ── AI 메뉴 (명세 11.1) — AI로 일정 조정 · AI로 TimeTable 자동 배치 ──
  const unplaced = unplacedOf(rawDays, today)
  const unplacedTotal = unplaced.reduce((n, d) => n + d.count, 0)
  const aiMenuItems = () => [
    {
      key: 'adjust',
      label: 'AI로 일정 조정',
      icon: <CalendarClock />,
      onSelect: () => {
        // 머리 아래 "일정 조정" 입력칸으로 (그 칸의 분석 이벤트가 그대로 나가요)
        const el = document.getElementById('schedule-ai-input')
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el?.focus({ preventScroll: true })
      },
    },
    {
      key: 'auto_place',
      label: 'AI로 TimeTable 자동 배치',
      icon: <Sparkles />,
      disabled: !unplacedTotal || proposing || fillPreviewing,
      hint: !unplacedTotal ? '배치할 시간 미정 Task가 없어요' : undefined,
      onSelect: () => {
        // AutoPlaceBar 의 "AI로 TimeTable 배치하기" 와 같은 동작 · 같은 이벤트
        track('calendar.auto_place_click', {
          view_mode: view,
          unscheduled_count: unplacedTotal,
          day_count: unplaced.length,
        })
        previewFill({ startDate: unplaced[0].date, endDate: unplaced[unplaced.length - 1].date })
      },
    },
  ]

  return (
    // 패널이 열려 있으면 xl 이상에서는 캘린더가 패널 폭만큼 비켜서 나란히 보여요
    // 모바일: 페이지 전체 흰 바탕 (명세 9.1) — 바깥 여백(px-5 · py-6)까지 덮어요
    <div
      className={cn(
        add && 'xl:pr-[420px]',
        'max-lg:bg-bg-surface max-lg:-mx-5 max-lg:-mt-6 max-lg:min-h-[calc(100dvh-48px-var(--tabbar-h))] max-lg:-mb-6 max-lg:px-5 max-lg:pt-6 max-lg:pb-6'
      )}
    >
      <PageHeader
        title="캘린더"
        description="블록을 눌러 배치 이유를 보고, 끌어서 시간을 바꿔요. 지난 빈 시간을 누르면 실제로 한 일을 남길 수 있어요."
        actions={
          <div className="flex items-center gap-2">
            {!add && (
              <Button
                variant="primary"
                size="sm"
                aria-haspopup="menu"
                onClick={(e) => {
                  // + 메뉴(3가지)를 열어요 (명세 11.2) — 메뉴 열기는 이벤트 없음, 항목을 고를 때 보내요
                  setMenu({ kind: 'add', anchor: rectOf(e.currentTarget) })
                }}
              >
                <Plus className="size-4" />
                Task 추가
              </Button>
            )}
            {/* AI 메뉴 (명세 11.1) — 웹에는 떠 있는 버튼이 없어서 머리글에 둬요. 일정 조정 바 · 자동 배치가 있는 일간 · 주간만 */}
            {view !== 'month' && (
              <Button
                variant="ai"
                size="sm"
                aria-haspopup="menu"
                onClick={(e) => setMenu({ kind: 'ai', anchor: rectOf(e.currentTarget) })}
              >
                <Sparkles className="size-4" />
                AI
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
            className={cn(iconButtonClass('md'), 'max-lg:size-7 max-lg:[&_svg]:size-4')}
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            aria-label={`다음 ${unit}`}
            className={cn(iconButtonClass('md'), 'max-lg:size-7 max-lg:[&_svg]:size-4')}
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
        <h2 className="text-h4 max-lg:text-h3" aria-live="polite">
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
          <div
            className={cn(
              view === 'day' && !add && 'grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]',
              // 주간 모바일: 머리 줄 아래(날짜 줄 · 격자)는 양옆 10 (명세 10.3)
              view === 'week' && 'max-lg:-mx-2.5'
            )}
          >
            <TimeGrid
              {...gridEvents}
              allowFutureEmpty
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

      {/* + 메뉴 · AI 메뉴 (명세 11) */}
      {menu?.kind === 'add' && (
        <ActionMenu
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          label="추가"
          items={addMenuItems(menu.slot, menu.anchor)}
        />
      )}
      {menu?.kind === 'ai' && (
        <ActionMenu anchor={menu.anchor} onClose={() => setMenu(null)} label="AI" items={aiMenuItems()} />
      )}

      {add && (
        <TaskAddPanel
          mode={add}
          prefill={add === 'manual' ? prefill : undefined}
          onClose={() => {
            setPrefill(undefined)
            go({ add: null })
          }}
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
        <span className="border-border-subtle size-2.5 rounded-sm border" style={HATCH} />
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
