'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface AnchorRect {
  top: number
  left: number
  right: number
  bottom: number
}

export const rectOf = (el: Element): AnchorRect => {
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, right: r.right, bottom: r.bottom }
}

interface PopoverProps {
  anchor: AnchorRect
  onClose: () => void
  children: ReactNode
  width?: number
  label?: string
  className?: string
}

const GAP = 8
const MARGIN = 12
const SHEET_BREAKPOINT = 640

/**
 * 클릭한 블록 옆에 뜨는 작은 창.
 *  - 넓은 화면: 블록 오른쪽(자리가 없으면 왼쪽)에 붙어요
 *  - 좁은 화면(640px 미만): 아래에서 올라오는 시트
 *  - 바깥 클릭 · ESC · 스크롤 · 창 크기 변경 시 닫혀요
 */
export function Popover({ anchor, onClose, children, width = 320, label, className }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  // 클릭으로만 열리는 컴포넌트라 첫 렌더에서 window 를 읽어도 안전해요 (resize 되면 닫힘)
  const [sheet] = useState(() => typeof window !== 'undefined' && window.innerWidth < SHEET_BREAKPOINT)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // 실제 높이를 잰 뒤 화면 안에 들어오게 위치를 DOM 에 바로 적용 (그리기 전에 실행 → 깜빡임 없음)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || sheet) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const h = el.offsetHeight
    let left = anchor.right + GAP
    if (left + width > vw - MARGIN) left = anchor.left - GAP - width
    if (left < MARGIN) left = Math.min(Math.max(MARGIN, anchor.left), vw - width - MARGIN)
    let top = anchor.top
    if (top + h > vh - MARGIN) top = vh - MARGIN - h
    top = Math.max(MARGIN, top)
    el.style.top = `${top}px`
    el.style.left = `${left}px`
    el.style.visibility = 'visible'
  }, [anchor, width, sheet])

  useEffect(() => {
    const inside = (t: EventTarget | null) => !!(t instanceof Node && ref.current?.contains(t))
    const onDown = (e: PointerEvent) => {
      if (!inside(e.target)) onCloseRef.current()
    }
    const onKey = (e: KeyboardEvent) => {
      // 안쪽 입력칸이 Esc 를 먼저 처리했으면(편집 취소) 창은 닫지 않아요
      if (e.key === 'Escape' && !e.defaultPrevented) onCloseRef.current()
    }
    const onScroll = (e: Event) => {
      if (!inside(e.target)) onCloseRef.current()
    }
    const onResize = () => onCloseRef.current()
    // 이 창을 연 클릭이 곧바로 "바깥 클릭"으로 잡히지 않도록 다음 틱에 등록
    const id = window.setTimeout(() => {
      document.addEventListener('pointerdown', onDown)
      window.addEventListener('scroll', onScroll, true)
    })
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      {sheet && <div className="fixed inset-0 z-40 bg-black/30" aria-hidden />}
      <div
        ref={ref}
        role="dialog"
        aria-label={label}
        style={sheet ? undefined : { top: anchor.top, left: anchor.right + GAP, width, visibility: 'hidden' }}
        className={cn(
          'bg-surface shadow-pop border-line fixed z-50 border',
          sheet
            ? 'inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl pb-[env(safe-area-inset-bottom)]'
            : 'max-h-[calc(100dvh-24px)] overflow-y-auto rounded-2xl',
          'animate-[modal-in_140ms_ease-out]',
          className
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="text-ink-3 hover:bg-subtle hover:text-ink absolute top-3 right-3 rounded-lg p-1.5"
        >
          <X className="size-4" />
        </button>
        {children}
      </div>
    </>,
    document.body
  )
}
