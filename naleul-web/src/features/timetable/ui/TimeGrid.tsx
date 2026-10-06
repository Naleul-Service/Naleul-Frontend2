'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { cn } from '@/lib/cn'
import { blockingOverlap, placeActivities, placeFixed, placeTasks } from '../layout'
import { WEEKDAY_LABEL, dayOfMonth, formatMinutes, minutesFrom, nowKst, weekdayIndex } from '../time'
import type { ActualActivity, FixedBlock, TimeBlockTask, TimetableDay } from '../types'
import { ActivityBlock, FixedBlockView, HATCH, TaskBlock, taskColors } from './Blocks'
import { canUnschedule, useGridDrag, type DragSource, type DragState, type DropTarget } from './useGridDrag'

export const HOUR_PX = 60
const PPM = HOUR_PX / 60
const UNSCHEDULED_VISIBLE = 3

export type Selection =
  { kind: 'task'; id: number } | { kind: 'fixed'; key: string } | { kind: 'activity'; id: number } | null

export const fixedKey = (b: FixedBlock) => `${b.lifePatternId}-${b.targetDate}-${b.start}`

/** 드래그로 옮길 수 있는 Task (완료·미션은 백엔드에서 409) */
export const canDragTask = (t: TimeBlockTask) => t.taskStatus !== 'COMPLETED' && t.sourceType !== 'MISSION'

/**
 * 드래그로 옮길 수 있는 고정 블록: 그날 안에서 시작하고 끝나는 것만.
 * 자정을 넘기는 수면은 화면에 날짜별 조각만 보여서 끌어도 실제 길이를 알 수 없어요 → 상세의 "이날만 시간 변경"으로.
 */
export const canDragFixed = (b: FixedBlock, date: string) =>
  !b.clippedFromPreviousDay && b.targetDate === date && minutesFrom(date, b.end) < 1440

const HEADER_PX = 56

interface Props {
  days: TimetableDay[]
  startHour: number
  endHour: number
  selection: Selection
  onSelectTask: (t: TimeBlockTask, e: MouseEvent<HTMLElement>) => void
  onSelectFixed: (b: FixedBlock, e: MouseEvent<HTMLElement>) => void
  /** 주간에서 날짜 머리글 클릭 → 일간 */
  onDayClick?: (date: string) => void
  /** 드래그해서 놓았을 때 (원래 자리와 같으면 호출되지 않아요) */
  onDrop?: (source: DragSource, target: DropTarget) => void
  /** 드래그가 시작될 때 (열린 팝오버 닫기 등) */
  onDragStart?: () => void
  /** "NEW" 표시할 Task (방금 만든 것) */
  highlightIds?: ReadonlySet<number>
  /** 격자 최대 높이 (기본: 화면 높이에 맞춤) */
  maxHeightClass?: string
  /** 실제로 한 일 — 있으면 그날 칸 오른쪽에 "실제" 칸이 생겨요 */
  activities?: ActualActivity[]
  onSelectActivity?: (a: ActualActivity, e: MouseEvent<HTMLElement>) => void
  /** 빈 칸(지난 시간)을 눌렀을 때 — 그 시각으로 "실제로 한 일" 기록 열기 */
  onEmptyClick?: (date: string, minutes: number, e: MouseEvent<HTMLElement>) => void
}

function sameAsSource(source: DragSource, target: DropTarget) {
  if (target.type === 'unscheduled') return source.start === null
  return target.date === source.date && target.start === source.start && target.end === source.end
}

/** 1분마다 바뀌는 현재 한국 시각 */
function useNowKst() {
  const [now, setNow] = useState(() => nowKst())
  useEffect(() => {
    const id = window.setInterval(() => setNow(nowKst()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

export function TimeGrid({
  days,
  startHour,
  endHour,
  selection,
  onSelectTask,
  onSelectFixed,
  onDayClick,
  onDrop,
  onDragStart,
  highlightIds,
  maxHeightClass = 'max-h-[max(480px,calc(100dvh-230px))]',
  activities = [],
  onSelectActivity,
  onEmptyClick,
}: Props) {
  const now = useNowKst()
  const from = startHour * 60
  const to = endHour * 60
  const geometry = { from, ppm: PPM }
  const hours = useMemo(
    () => Array.from({ length: endHour - startHour }, (_, i) => startHour + i),
    [startHour, endHour]
  )
  const single = days.length === 1
  const scrollRef = useRef<HTMLDivElement>(null)
  const rangeKey = `${days[0]?.date}_${days.length}`

  // 처음 보거나 기간이 바뀌면: 오늘이 보이면 현재 시각 근처로, 아니면 맨 위로 스크롤
  const scrolledFor = useRef<string | null>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !days.length || scrolledFor.current === rangeKey) return
    scrolledFor.current = rangeKey
    const hasToday = days.some((d) => d.date === now.date)
    el.scrollTop = hasToday ? Math.max(0, (now.minutes - from - 90) * PPM) : 0
  }, [rangeKey, days, now, from])

  // ── 드래그 ──
  const validate = useCallback(
    (source: DragSource, target: DropTarget) => {
      if (source.kind !== 'task' || target.type !== 'grid') return null
      const day = days.find((d) => d.date === target.date)
      const hit = day && blockingOverlap(day, target.start, target.end, source.task.taskId)
      return hit ? `"${hit.taskName}"과(와) 겹쳐요` : null
    },
    [days]
  )
  const { drag, startDrag, consumeClick } = useGridDrag({
    scrollRef,
    from,
    to,
    ppm: PPM,
    stickyTop: HEADER_PX,
    validate,
    onDrop: (source, target) => {
      if (!sameAsSource(source, target)) onDrop?.(source, target)
    },
    onActivate: onDragStart,
  })
  const enabled = !!onDrop
  const isDragging = (kind: 'task' | 'fixed', id: string | number) =>
    !!drag &&
    (kind === 'task'
      ? drag.source.kind === 'task' && drag.source.task.taskId === id
      : drag.source.kind === 'fixed' && fixedKey(drag.source.block) === id)

  const selectTask = (t: TimeBlockTask, e: MouseEvent<HTMLElement>) => {
    if (!consumeClick()) onSelectTask(t, e)
  }
  const selectFixed = (b: FixedBlock, e: MouseEvent<HTMLElement>) => {
    if (!consumeClick()) onSelectFixed(b, e)
  }
  const selectActivity = (a: ActualActivity, e: MouseEvent<HTMLElement>) => {
    if (!consumeClick()) onSelectActivity?.(a, e)
  }
  // 블록이 없는 빈 곳을 누르면 그 시각(30분 단위)으로 실제 기록 열기 — 지난 시간만
  const clickEmpty = (date: string, e: MouseEvent<HTMLDivElement>) => {
    if (!onEmptyClick || consumeClick() || e.target !== e.currentTarget) return
    const rect = e.currentTarget.getBoundingClientRect()
    const minutes = Math.floor((from + (e.clientY - rect.top) / PPM) / 30) * 30
    if (date > now.date || (date === now.date && minutes >= now.minutes)) return
    onEmptyClick(date, minutes, e)
  }

  // 날짜 수만큼 칸 (주간 7칸, Task 추가 결과 화면은 1~7칸)
  const gridTemplateColumns = single ? '56px minmax(0,1fr)' : `56px repeat(${days.length}, minmax(112px, 1fr))`
  // Task 를 끌고 있으면 "시간 미정"으로 놓을 수 있게 빈 줄이라도 보여줘요
  const showUnscheduledRow = days.some((d) => d.unscheduledTasks.length > 0) || (!!drag && canUnschedule(drag.source))

  return (
    <div
      ref={scrollRef}
      className={cn('border-line bg-surface relative overflow-auto rounded-2xl border', maxHeightClass)}
      data-testid="time-grid"
    >
      <div className={cn('grid min-w-full', !single && 'w-max lg:w-full')} style={{ gridTemplateColumns }}>
        {/* ── 머리글 (날짜) ── */}
        <div className="bg-surface border-line sticky top-0 left-0 z-40 h-14 border-b" />
        {days.map((d) => {
          const isToday = d.date === now.date
          const wd = weekdayIndex(d.date)
          const Head = onDayClick && !single ? 'button' : 'div'
          return (
            <Head
              key={d.date}
              {...(Head === 'button' ? { type: 'button' as const, onClick: () => onDayClick?.(d.date) } : {})}
              className={cn(
                'bg-surface border-line sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-l px-3 text-left',
                Head === 'button' && 'hover:bg-subtle/60'
              )}
              aria-label={Head === 'button' ? `${d.date} 일간 보기` : undefined}
            >
              <span
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-full text-[15px] font-bold',
                  isToday ? 'bg-brand text-white' : wd === 6 ? 'text-danger' : wd === 5 ? 'text-brand' : 'text-ink'
                )}
              >
                {dayOfMonth(d.date)}
              </span>
              <span className="min-w-0">
                <span className={cn('block text-xs font-semibold', isToday ? 'text-brand' : 'text-ink-3')}>
                  {WEEKDAY_LABEL[wd]}요일
                </span>
                <span className="text-ink-3 block truncate text-[11px]">
                  {/* 아직 오지 않은 날은 실행률 대신 개수 */}
                  {!d.stats.total
                    ? 'Task 없음'
                    : d.date > now.date
                      ? `Task ${d.stats.total}개`
                      : `실행률 ${d.stats.rate ?? 0}%`}
                </span>
              </span>
            </Head>
          )
        })}

        {/* ── 시간 미정 ── */}
        {showUnscheduledRow && (
          <>
            {/* 머리글 바로 아래에 붙어 있어서 스크롤해도 보여요 */}
            <div className="bg-surface border-line text-ink-3 sticky top-14 left-0 z-40 border-b px-1 py-2 text-center text-[11px] leading-tight">
              시간
              <br />
              미정
            </div>
            {days.map((d) => (
              <UnscheduledCell
                key={d.date}
                date={d.date}
                tasks={d.unscheduledTasks}
                selection={selection}
                onSelect={selectTask}
                drag={drag}
                onDragDown={
                  enabled
                    ? (e, t) => startDrag(e, { kind: 'task', task: t, date: d.date, start: null, end: null })
                    : undefined
                }
              />
            ))}
          </>
        )}

        {/* ── 시간 눈금 ── */}
        <div className="bg-surface sticky left-0 z-[25] select-none" style={{ height: (to - from) * PPM }}>
          {hours.map((h, i) => (
            <span
              key={h}
              className="text-ink-4 absolute right-2 -translate-y-1/2 text-[11px] tabular-nums"
              style={{ top: i * HOUR_PX }}
            >
              {i === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
            </span>
          ))}
        </div>

        {/* ── 날짜 칸 ── */}
        {days.map((d) => {
          const fixed = placeFixed(d, from, to)
          const tasks = placeTasks(d, from, to)
          const acts = placeActivities(d.date, activities, from, to)
          // 실제 기록이 있는 날은 "계획 | 실제"로 나눠서 나란히 보여줘요
          const split = acts.length > 0
          const isToday = d.date === now.date
          const canClickEmpty = !!onEmptyClick && d.date <= now.date
          return (
            <div
              key={d.date}
              data-date={d.date}
              onClick={(e) => clickEmpty(d.date, e)}
              className={cn(
                'border-line relative border-l',
                isToday && 'bg-brand-soft/30',
                canClickEmpty && 'cursor-cell'
              )}
              style={{ height: (to - from) * PPM }}
            >
              {hours.map((h, i) => (
                <div
                  key={h}
                  className="border-line pointer-events-none absolute inset-x-0 border-t"
                  style={{ top: i * HOUR_PX }}
                />
              ))}
              {fixed.map((p) => (
                <FixedBlockView
                  key={fixedKey(p.item)}
                  placed={p}
                  geometry={geometry}
                  selected={selection?.kind === 'fixed' && selection.key === fixedKey(p.item)}
                  onSelect={selectFixed}
                  dimmed={isDragging('fixed', fixedKey(p.item))}
                  drag={
                    enabled && canDragFixed(p.item, d.date)
                      ? (e, mode) =>
                          startDrag(e, { kind: 'fixed', block: p.item, date: d.date, start: p.start, end: p.end }, mode)
                      : undefined
                  }
                />
              ))}
              <div
                className={cn(
                  'pointer-events-none absolute inset-y-0 left-0 *:pointer-events-auto',
                  split ? 'right-[40%]' : 'right-0'
                )}
              >
                {tasks.map((p) => (
                  <TaskBlock
                    key={p.item.taskId}
                    placed={p}
                    geometry={geometry}
                    selected={selection?.kind === 'task' && selection.id === p.item.taskId}
                    onSelect={selectTask}
                    dimmed={isDragging('task', p.item.taskId)}
                    isNew={highlightIds?.has(p.item.taskId)}
                    drag={
                      enabled && canDragTask(p.item)
                        ? (e, mode) =>
                            startDrag(e, { kind: 'task', task: p.item, date: d.date, start: p.start, end: p.end }, mode)
                        : undefined
                    }
                  />
                ))}
              </div>
              {split && (
                <div className="border-line/70 pointer-events-none absolute inset-y-0 right-0 w-[40%] border-l border-dashed *:pointer-events-auto">
                  {acts.map((p) => (
                    <ActivityBlock
                      key={p.item.activityId}
                      placed={p}
                      geometry={geometry}
                      selected={selection?.kind === 'activity' && selection.id === p.item.activityId}
                      onSelect={selectActivity}
                    />
                  ))}
                </div>
              )}
              {drag?.target?.type === 'grid' && drag.target.date === d.date && (
                <DragGhost drag={drag} target={drag.target} from={from} />
              )}
              {isToday && now.minutes >= from && now.minutes <= to && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-20 h-0 border-t-2 border-red-500"
                  style={{ top: (now.minutes - from) * PPM }}
                  aria-hidden
                >
                  <span className="absolute -top-[5px] -left-[5px] size-2 rounded-full bg-red-500" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function UnscheduledCell({
  date,
  tasks,
  selection,
  onSelect,
  drag,
  onDragDown,
}: {
  date: string
  tasks: TimeBlockTask[]
  selection: Selection
  onSelect: (t: TimeBlockTask, e: MouseEvent<HTMLElement>) => void
  drag: DragState | null
  onDragDown?: (e: PointerEvent<HTMLElement>, t: TimeBlockTask) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? tasks : tasks.slice(0, UNSCHEDULED_VISIBLE)
  const more = tasks.length - shown.length
  const isTarget = drag?.target?.type === 'unscheduled' && drag.target.date === date
  return (
    <div
      data-unscheduled-date={date}
      className={cn(
        'bg-surface border-line sticky top-14 z-30 flex max-h-32 min-h-10 min-w-0 flex-col gap-1 overflow-y-auto border-b border-l p-1.5',
        isTarget && 'bg-brand-soft outline-brand outline-2 -outline-offset-2 outline-dashed'
      )}
    >
      {isTarget && <p className="text-brand px-1 text-[11px] font-semibold">여기에 놓으면 시간 미정</p>}
      {shown.map((t) => {
        const draggable = !!onDragDown && canDragTask(t)
        return (
          <button
            key={t.taskId}
            type="button"
            data-task-id={t.taskId}
            onClick={(e) => onSelect(t, e)}
            onPointerDown={draggable ? (e) => onDragDown(e, t) : undefined}
            style={{ ...taskColors(t), WebkitTouchCallout: 'none', userSelect: 'none' }}
            className={cn(
              'shrink-0 truncate rounded-md px-2 py-1 text-left text-[11px] font-semibold',
              draggable && 'cursor-grab',
              t.taskStatus === 'COMPLETED' && 'line-through opacity-55',
              drag?.source.kind === 'task' && drag.source.task.taskId === t.taskId && 'opacity-30',
              selection?.kind === 'task' && selection.id === t.taskId && 'ring-ink ring-2'
            )}
          >
            {t.emoji ? `${t.emoji} ` : ''}
            {t.taskName}
          </button>
        )
      })}
      {more > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-ink-3 hover:text-ink px-1 text-left text-[11px]"
        >
          +{more}개 더보기
        </button>
      )}
    </div>
  )
}

/** 드래그 중 놓일 자리 미리보기 */
function DragGhost({
  drag,
  target,
  from,
}: {
  drag: DragState
  target: Extract<DropTarget, { type: 'grid' }>
  from: number
}) {
  const { source, invalid } = drag
  const title =
    source.kind === 'task'
      ? `${source.task.emoji ? `${source.task.emoji} ` : ''}${source.task.taskName}`
      : source.block.title
  const style =
    source.kind === 'task'
      ? taskColors(source.task)
      : { ...HATCH, color: 'var(--color-ink-2)', borderColor: 'var(--color-ink-4)' }
  return (
    <div
      data-drag-ghost
      aria-live="polite"
      className={cn(
        'pointer-events-none absolute inset-x-0.5 z-30 flex flex-col overflow-hidden rounded-lg border px-2 py-1 text-xs leading-tight shadow-[0_8px_24px_rgb(17_17_17/0.22)]',
        invalid ? 'border-danger ring-danger ring-2' : 'border-white/60'
      )}
      style={{
        ...style,
        top: (target.start - from) * PPM,
        height: Math.max((target.end - target.start) * PPM - 2, 18),
      }}
    >
      <span className="truncate font-semibold">{title}</span>
      <span className="truncate font-bold tabular-nums">
        {formatMinutes(target.start)} – {formatMinutes(target.end)}
      </span>
      {invalid && (
        <span className="bg-danger mt-auto self-start rounded px-1 py-0.5 text-[10px] font-semibold text-white">
          {invalid}
        </span>
      )}
    </div>
  )
}
