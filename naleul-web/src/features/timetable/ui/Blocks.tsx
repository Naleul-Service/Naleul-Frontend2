'use client'

import type { CSSProperties, MouseEvent, PointerEvent } from 'react'
import { Check, Pin, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { hexOf, shownTime, withAlpha, type Placed } from '../layout'
import { formatMinutes, todayKst } from '../time'
import type { ActualActivity, FixedBlock, TimeBlockTask } from '../types'

/** 빗금 배경 (고정 시간) */
export const HATCH: CSSProperties = {
  backgroundColor: '#F6F7F9',
  backgroundImage: 'repeating-linear-gradient(135deg, #E6E8EC 0 1.5px, transparent 1.5px 8px)',
}

interface Geometry {
  /** 화면 시작 시각(분) */
  from: number
  /** 1분당 px */
  ppm: number
}

/** 드래그 가능한 블록에 붙는 핸들러. 없으면 드래그 불가 */
export type BlockDrag = (e: PointerEvent<HTMLElement>, mode: 'move' | 'resize') => void

// 길게 눌렀을 때 iOS 의 텍스트 선택·메뉴가 뜨지 않게
const NO_CALLOUT: CSSProperties = { WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }

/** 블록 아래쪽 가장자리를 잡고 늘리기/줄이기 */
function ResizeHandle({ onDrag, light }: { onDrag: BlockDrag; light?: boolean }) {
  return (
    <span
      aria-hidden
      data-resize-handle
      onPointerDown={(e) => onDrag(e, 'resize')}
      className="group/handle absolute inset-x-0 bottom-0 flex h-2 cursor-ns-resize items-end justify-center"
    >
      <span
        className={cn(
          'mb-0.5 h-1 w-6 rounded-full opacity-0 transition-opacity group-hover/handle:opacity-100',
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
      backgroundColor: '#fff',
      backgroundImage: `linear-gradient(${soft}, ${soft})`,
      borderLeft: `3px solid ${c}`,
      color: '#111',
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
}) {
  const t = placed.item
  const heightPx = (placed.bottom - placed.top) * geometry.ppm
  const short = heightPx < 26 // 10~20분 블록: 한 줄로 가운데 정렬
  const done = t.taskStatus === 'COMPLETED'
  // 완료 후 실제 시각에 그려진 블록 ("실제" 표시)
  const actual = shownTime(t)?.actual ?? false
  const solid = t.sourceType !== 'ROUTINE'
  const width = 100 / placed.cols
  const style: CSSProperties = {
    ...pos(placed, geometry),
    left: `calc(${placed.col * width}% + 2px)`,
    width: `calc(${width}% - 4px)`,
    ...taskColors(t),
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
        selected && 'ring-ink ring-2 ring-offset-1',
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
      {drag && !placed.clippedBottom && <ResizeHandle onDrag={drag} />}
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
