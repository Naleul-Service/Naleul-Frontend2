'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { TaskAddView, type TaskAddedInfo } from './TaskAddView'

/** 패널 폭 — 캘린더는 이만큼 비켜서 나란히 보여요 (xl 이상) */
export const TASK_PANEL_WIDTH = 420

/**
 * 캘린더 오른쪽에 여는 Task 추가 패널.
 *  - xl(1280px) 이상: 캘린더 옆에 나란히 (캘린더를 보면서 빈 시간을 골라 추가)
 *  - 그보다 좁으면: 오른쪽에서 덮는 시트, 모바일은 화면 전체
 * 추가하면 옆 캘린더가 그 날짜로 이동하고 새 블록에 NEW 가 붙어요 (onAdded).
 */
export function TaskAddPanel({
  mode,
  onClose,
  onAdded,
}: {
  mode: 'ai' | 'manual' | 'log'
  onClose: () => void
  onAdded: (info: TaskAddedInfo) => void
}) {
  // Esc 로 닫기 — 입력 중이거나 다른 창(모달·팝오버)이 떠 있으면 그쪽이 먼저
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const el = e.target instanceof HTMLElement ? e.target : null
      if (el?.closest('input, textarea, select, [role="dialog"]')) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <aside
      aria-label="Task 추가"
      className="bg-canvas border-line shadow-pop fixed inset-0 z-40 flex animate-[slide-in-right_180ms_ease-out] flex-col sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[420px] sm:border-l xl:shadow-none"
    >
      <div className="border-line bg-surface flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <p className="text-[16px] font-bold">Task 추가</p>
        <p className="text-ink-3 hidden text-xs sm:block">캘린더를 보면서 추가해요</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Task 추가 닫기"
          className="text-ink-3 hover:bg-subtle hover:text-ink ml-auto rounded-lg p-1.5"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <TaskAddView key={mode} variant="panel" initialMode={mode} onAdded={onAdded} />
      </div>
    </aside>
  )
}
