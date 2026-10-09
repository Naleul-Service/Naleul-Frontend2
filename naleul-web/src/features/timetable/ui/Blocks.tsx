'use client'

import type { CSSProperties, MouseEvent, PointerEvent } from 'react'
import { Check, GripHorizontal, Pin, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { hexOf, shownTime, withAlpha, type Placed, type PlacedSleep } from '../layout'
import { formatMinutes, minutesToTime, todayKst } from '../time'
import type { ActualActivity, FixedBlock, TimeBlockTask } from '../types'

/** 빗금 배경 (고정 시간) */
export const HATCH: CSSProperties = {
  backgroundColor: 'var(--color-hatch)',
  backgroundImage: 'repeating-linear-gradient(135deg, var(--color-hatch-line) 0 1.5px, transparent 1.5px 8px)',
}

interface Geometry {
  /** 화면 시작 시각(분) */
  from: number
  /** 1분당 px */
  ppm: number
}

/** 드래그 가능한 블록에 붙는 핸들러. 없으면 드래그 불가 */
export type BlockDrag = (e: PointerEvent<HTMLElement>, mode: 'move' | 'resize' | 'resize-top') => void

/** 이보다 낮은 블록은 위 끝 핸들을 숨겨요 (위·아래 핸들이 블록을 다 덮으면 옮길 곳이 없어서) */
const TOP_HANDLE_MIN_PX = 22

// 길게 눌렀을 때 iOS 의 텍스트 선택·메뉴가 뜨지 않게
const NO_CALLOUT: CSSProperties = { WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }

/** 블록 위·아래 가장자리를 잡고 늘리기/줄이기 (위 = 시작 시각, 아래 = 끝 시각) */
function ResizeHandle({
  onDrag,
  light,
  edge = 'bottom',
}: {
  onDrag: BlockDrag
  light?: boolean
  edge?: 'top' | 'bottom'
}) {
  const top = edge === 'top'
  return (
    <span
      aria-hidden
      data-resize-handle={edge}
      onPointerDown={(e) => onDrag(e, top ? 'resize-top' : 'resize')}
      className={cn(
        'group/handle absolute inset-x-0 flex h-2 cursor-ns-resize justify-center',
        top ? 'top-0 items-start' : 'bottom-0 items-end'
      )}
    >
      <span
        className={cn(
          'h-1 w-6 rounded-full opacity-0 transition-opacity group-hover/handle:opacity-100',
          top ? 'mt-0.5' : 'mb-0.5',
          light ? 'bg-white/70' : 'bg-ink-4'
        )}
      />
    </span>
  )
}

const pos = (p: Placed<unknown>, g: Geometry): CSSProperties => ({
  top: (p.top - g.from) * g.ppm,
  height: Math.max((p.bottom - p.top) * g.ppm - 2, 16),
})

/**
 * 블록 스타일 (명세 8)
 *  - 루틴: 연한 목표 색 + 왼쪽 진한 선
 *  - 일반 Task: 진한 목표 색 + 흰 글씨
 *  - 완료: ✓ 초록, 흐리게 / 놓침: ✕ 빨강 / 직접 정한 시간: 📌 (자물쇠는 "못 움직인다"로 보여서 핀으로 — 드래그로 옮길 수 있어요)
 */
export function taskColors(t: TimeBlockTask): CSSProperties {
  const c = hexOf(t.goalColorCode)
  if (t.sourceType === 'ROUTINE') {
    // 아래 빗금(고정 시간)이 비치지 않도록 흰 바탕 위에 연한 색을 겹쳐요
    const soft = withAlpha(c, 0.16)
    return {
      backgroundColor: 'var(--color-surface)',
      backgroundImage: `linear-gradient(${soft}, ${soft})`,
      borderLeft: `3px solid ${c}`,
      color: 'var(--color-ink)',
    }
  }
  return { backgroundColor: c, color: '#fff' }
}

export function TaskBlock({
  placed,
  geometry,
  selected,
  onSelect,
  drag,
  dimmed,
  isNew,
  grouped,
  planned,
  faded,
  focused,
}: {
  placed: Placed<TimeBlockTask>
  geometry: Geometry
  selected: boolean
  onSelect: (t: TimeBlockTask, e: MouseEvent<HTMLButtonElement>) => void
  drag?: BlockDrag
  /** 드래그 중인 원래 자리 */
  dimmed?: boolean
  /** 방금 만든 Task (NEW 표시) */
  isNew?: boolean
  /** 묶음 드래그로 같이 옮길 Task (점선 테두리) */
  grouped?: boolean
  /** 일간 "계획" 칸: 완료했어도 계획한 시각으로 그렸으니 "실제" 표시를 하지 않아요 */
  planned?: boolean
  /** 확인을 기다리는 블록에 눈이 가도록 흐리게 */
  faded?: boolean
  /** 확인을 기다리는 블록 (테두리 강조) */
  focused?: boolean
}) {
  const t = placed.item
  const heightPx = (placed.bottom - placed.top) * geometry.ppm
  const short = heightPx < 26 // 10~20분 블록: 한 줄로 가운데 정렬
  const done = t.taskStatus === 'COMPLETED'
  // 완료 후 실제 시각에 그려진 블록 ("실제" 표시)
  const actual = !planned && (shownTime(t)?.actual ?? false)
  // 22시 이월 제안(아직 확인 안 함): 점선 + 연한 바탕 — "확정된 일정이 아니라 제안"으로 보이게
  const proposed = (!!t.carryPending || !!t.proposed) && !done
  const solid = t.sourceType !== 'ROUTINE' && !proposed
  const width = 100 / placed.cols
  const goalColor = hexOf(t.goalColorCode)
  const style: CSSProperties = {
    ...pos(placed, geometry),
    left: `calc(${placed.col * width}% + 2px)`,
    width: `calc(${width}% - 4px)`,
    ...(proposed
      ? { backgroundColor: withAlpha(goalColor, 0.1), color: 'var(--color-ink)', border: `2px dashed ${goalColor}` }
      : taskColors(t)),
    ...NO_CALLOUT,
  }

  return (
    <button
      type="button"
      data-task-id={t.taskId}
      onClick={(e) => onSelect(t, e)}
      onPointerDown={drag ? (e) => drag(e, 'move') : undefined}
      style={style}
      aria-label={`${t.taskName} ${actual ? '실제 ' : ''}${formatMinutes(placed.start)}~${formatMinutes(placed.end)}`}
      className={cn(
        'absolute z-10 flex flex-col overflow-hidden rounded-lg px-2 text-left text-xs leading-tight transition-shadow',
        short ? 'justify-center rounded-md py-0 text-[11px]' : 'py-1',
        'hover:shadow-[0_2px_8px_rgb(17_17_17/0.18)]',
        done && 'opacity-55',
        drag && 'cursor-grab active:cursor-grabbing',
        dimmed && 'opacity-30',
        // 미리보기 중 제안 블록을 돋보이게 — 나머지는 흐리게(faded)
        faded && 'opacity-50 saturate-[.8]',
        focused && 'ring-brand z-[12] shadow-[0_6px_18px_rgb(61_90_254/0.35)] ring-2 ring-offset-1 ring-offset-surface',
        selected && 'ring-ink ring-2 ring-offset-1',
        grouped && 'outline-brand z-[11] outline-2 outline-offset-1 outline-dashed',
        placed.clippedTop && 'rounded-t-none',
        placed.clippedBottom && 'rounded-b-none'
      )}
    >
      <span className="flex min-w-0 items-center gap-1">
        {done && (
          <span className="bg-success grid size-3.5 shrink-0 place-items-center rounded-full text-white">
            <Check className="size-2.5" strokeWidth={3.5} />
          </span>
        )}
        {t.missed && (
          <span className="bg-danger grid size-3.5 shrink-0 place-items-center rounded-full text-white">
            <X className="size-2.5" strokeWidth={3.5} />
          </span>
        )}
        <span className={cn('min-w-0 flex-1 truncate font-semibold', done && 'line-through')}>
          {t.emoji ? `${t.emoji} ` : ''}
          {t.taskName}
        </span>
        {isNew && (
          <span className="bg-danger shrink-0 rounded px-1 text-[9px] leading-[14px] font-bold text-white">NEW</span>
        )}
        {proposed && (
          <span className="bg-ink shrink-0 rounded px-1 text-[9px] leading-[14px] font-bold text-on-ink">
            {t.proposed ? 'AI 제안' : '옮길까요?'}
          </span>
        )}
        {t.locked && (
          <Pin
            aria-label="직접 정한 시간"
            className={cn('size-3 shrink-0 rotate-45', solid ? 'text-white/85' : 'text-ink-3')}
          />
        )}
      </span>
      {heightPx >= 34 && (
        <span className={cn('mt-0.5 truncate', solid ? 'text-white/80' : 'text-ink-3')}>
          {actual && '실제 '}
          {formatMinutes(placed.start)} – {formatMinutes(placed.end)}
        </span>
      )}
      {drag && !placed.clippedTop && heightPx >= TOP_HANDLE_MIN_PX && (
        <ResizeHandle onDrag={drag} light={solid} edge="top" />
      )}
      {drag && !placed.clippedBottom && <ResizeHandle onDrag={drag} light={solid} />}
    </button>
  )
}

export function FixedBlockView({
  placed,
  geometry,
  selected,
  onSelect,
  drag,
  dimmed,
}: {
  placed: Placed<FixedBlock>
  geometry: Geometry
  selected: boolean
  onSelect: (b: FixedBlock, e: MouseEvent<HTMLButtonElement>) => void
  drag?: BlockDrag
  dimmed?: boolean
}) {
  const b = placed.item
  const heightPx = (placed.bottom - placed.top) * geometry.ppm
  return (
    <button
      type="button"
      data-fixed-id={`${b.lifePatternId}-${b.targetDate}`}
      onClick={(e) => onSelect(b, e)}
      onPointerDown={drag ? (e) => drag(e, 'move') : undefined}
      style={{ ...pos(placed, geometry), ...HATCH, ...NO_CALLOUT }}
      aria-label={`고정 시간 ${b.title} ${formatMinutes(placed.start)}~${formatMinutes(placed.end)}`}
      className={cn(
        'border-line-strong text-ink-3 absolute inset-x-0.5 z-0 flex flex-col overflow-hidden rounded-lg border border-dashed px-2 py-1 text-left text-[11px] leading-tight',
        'hover:border-ink-4',
        drag && 'cursor-grab active:cursor-grabbing',
        dimmed && 'opacity-40',
        selected && 'ring-ink-3 ring-2',
        placed.clippedTop && 'rounded-t-none border-t-0',
        placed.clippedBottom && 'rounded-b-none border-b-0'
      )}
    >
      <span className="truncate font-semibold">
        {b.emoji ? `${b.emoji} ` : ''}
        {b.title}
        {/* 기본 시간과 다르게 바꾼 날 (이날만·이번 주로 바꾼 경우). 지난 날짜는 "앞으로" 변경 때 예전 시간으로 고정해 둔 것이라 표시하지 않아요 */}
        {b.overridden && b.targetDate >= todayKst() && <span className="text-brand ml-1 font-medium">· 변경</span>}
      </span>
      {heightPx >= 30 && (
        <span className="truncate">
          {formatMinutes(placed.start)} – {formatMinutes(placed.end)}
        </span>
      )}
      {drag && !placed.clippedTop && heightPx >= TOP_HANDLE_MIN_PX && <ResizeHandle onDrag={drag} edge="top" />}
      {drag && !placed.clippedBottom && <ResizeHandle onDrag={drag} />}
    </button>
  )
}

/** 수면 배경 (고정 시간 빗금보다 진한 남색 톤) */
const SLEEP_BG: CSSProperties = {
  backgroundColor: 'var(--color-sleep)',
  backgroundImage: 'repeating-linear-gradient(135deg, var(--color-sleep-line) 0 1.5px, transparent 1.5px 9px)',
}

/**
 * 수면 블록 — 기상 전(아침)·취침 후(밤) 2시간만큼 보여요.
 * 아침 블록은 아래 가장자리(= 기상), 밤 블록은 위 가장자리(= 취침)를 끌어서 시간을 바꿔요.
 * 블록 전체를 옮기는 드래그는 없어요 (기상·취침 중 하나만 바꾸는 게 보통이라서).
 */
export function SleepBlockView({
  placed,
  geometry,
  selected,
  onSelect,
  drag,
  dimmed,
}: {
  placed: PlacedSleep
  geometry: Geometry
  selected: boolean
  onSelect: (b: FixedBlock, e: MouseEvent<HTMLButtonElement>) => void
  drag?: BlockDrag
  dimmed?: boolean
}) {
  const b = placed.item
  const wake = placed.edge === 'wake'
  const time = minutesToTime(wake ? placed.end : placed.start)
  const label = wake ? `기상 ${time}` : `취침 ${time}`
  return (
    <button
      type="button"
      data-fixed-id={`${b.lifePatternId}-${b.targetDate}`}
      data-sleep-edge={placed.edge}
      onClick={(e) => onSelect(b, e)}
      style={{ ...pos(placed, geometry), ...SLEEP_BG, ...NO_CALLOUT }}
      aria-label={`수면 · ${label}`}
      className={cn(
        'text-ink-3 absolute inset-x-0 z-0 flex flex-col overflow-hidden text-left text-[11px] leading-tight',
        wake ? 'justify-end' : 'justify-start',
        dimmed && 'opacity-40',
        selected && 'ring-ink-3 ring-2'
      )}
    >
      {/* 끌 수 있는 가장자리 — 늘 보이는 손잡이 (마우스를 올려야 보이는 다른 블록과 달리 처음 보는 사람도 알 수 있게) */}
      <span
        aria-hidden
        onPointerDown={drag ? (e) => drag(e, wake ? 'resize' : 'resize-top') : undefined}
        className={cn(
          'flex h-6 shrink-0 items-center gap-1 border-[#8EA2FF] px-2 font-semibold text-sleep-ink',
          wake ? 'border-b-2' : 'border-t-2',
          drag && 'cursor-ns-resize hover:bg-sleep-line'
        )}
      >
        <span className="truncate">
          {wake ? '☀️' : '🌙'} {label}
        </span>
        {drag && <GripHorizontal className="ml-auto size-3.5 shrink-0 opacity-70" />}
      </span>
    </button>
  )
}

/**
 * 실제로 한 일 블록 — 그날 칸 오른쪽 "실제" 칸에 그려요.
 * 계획(Task) 블록과 헷갈리지 않게 흰 바탕 + 초록 왼쪽 선 + "실제" 표시, 목표를 연결했으면 그 색 선.
 */
export function ActivityBlock({
  placed,
  geometry,
  selected,
  onSelect,
}: {
  placed: Placed<ActualActivity>
  geometry: Geometry
  selected: boolean
  onSelect: (a: ActualActivity, e: MouseEvent<HTMLButtonElement>) => void
}) {
  const a = placed.item
  const heightPx = (placed.bottom - placed.top) * geometry.ppm
  const short = heightPx < 34
  const color = a.goalColorCode ? (a.goalColorCode.startsWith('#') ? a.goalColorCode : `#${a.goalColorCode}`) : null
  return (
    <button
      type="button"
      data-activity-id={a.activityId}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(a, e)
      }}
      style={{
        ...pos(placed, geometry),
        // 주간처럼 Task 와 한 열에 섞어 그릴 때 겹치면 나란히 (cols 가 1 이면 칸 전체)
        ...(placed.cols > 1
          ? { left: `calc(${(placed.col * 100) / placed.cols}% + 2px)`, width: `calc(${100 / placed.cols}% - 4px)` }
          : {}),
        ...NO_CALLOUT,
        borderLeftColor: color ?? 'var(--color-success)',
      }}
      aria-label={`실제로 한 일 ${a.title} ${formatMinutes(placed.start)}~${formatMinutes(placed.end)}`}
      className={cn(
        'border-line bg-surface absolute inset-x-0.5 z-10 flex flex-col overflow-hidden rounded-lg border border-l-[3px] px-1.5 text-left text-[11px] leading-tight shadow-[0_1px_2px_rgb(17_17_17/0.06)]',
        'hover:shadow-[0_2px_8px_rgb(17_17_17/0.16)]',
        short ? 'justify-center py-0' : 'py-1',
        selected && 'ring-ink ring-2 ring-offset-1',
        placed.clippedTop && 'rounded-t-none',
        placed.clippedBottom && 'rounded-b-none'
      )}
    >
      <span className="flex min-w-0 items-center gap-1">
        <span className="text-success shrink-0 text-[10px] font-bold">✓</span>
        <span className="truncate font-semibold">
          {a.emoji ? `${a.emoji} ` : ''}
          {a.title}
        </span>
      </span>
      {!short && (
        <span className="text-ink-3 truncate tabular-nums">
          {formatMinutes(placed.start)}–{formatMinutes(placed.end)}
        </span>
      )}
      {heightPx >= 56 && a.replacedTaskName && <span className="text-ink-4 truncate">대신: {a.replacedTaskName}</span>}
    </button>
  )
}
