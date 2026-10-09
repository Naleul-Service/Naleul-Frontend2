'use client'

import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'

/**
 * "AI로 배치하기" 미리보기 확인 바 — 점선 블록을 끌어 고친 뒤 [이대로 진행] 하면 저장, [취소] 하면 아무것도 안 바뀌어요.
 */
export function FillProposalBar({
  count,
  edited,
  unscheduled,
  loading,
  onApply,
  onCancel,
}: {
  count: number
  /** 사용자가 끌어서 고친 제안 수 */
  edited: number
  /** 빈 시간이 없어 제안하지 못한 수 */
  unscheduled: number
  loading: boolean
  onApply: () => void
  onCancel: () => void
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div
        role="dialog"
        aria-label="AI 배치 확인"
        className="bg-surface shadow-pop border-line pointer-events-auto w-full max-w-[600px] animate-[modal-in_160ms_ease-out] rounded-2xl border p-4"
      >
        <div className="flex items-start gap-3">
          <span className="bg-brand grid size-9 shrink-0 place-items-center rounded-full text-white">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] leading-snug font-bold">
              {count > 0 ? `점선 자리에 ${count}개를 배치할게요. 이대로 진행할까요?` : '배치할 빈 시간을 찾지 못했어요'}
            </p>
            <p className="text-ink-3 mt-0.5 text-[12px] leading-relaxed">
              {count > 0 && '마음에 안 드는 블록은 끌어서 옮겨 보세요. 시간 미정 칸으로 끌면 이번 배치에서 빠져요.'}
              {edited > 0 && ` 직접 옮긴 ${edited}개는 📌 고정돼요.`}
              {unscheduled > 0 && ` 빈 시간이 없어 ${unscheduled}개는 시간 미정으로 남아요.`}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {count > 0 && (
            <Button size="sm" variant="brand" loading={loading} onClick={onApply}>
              이대로 진행
            </Button>
          )}
          <Button size="sm" variant="secondary" disabled={loading} onClick={onCancel}>
            {count > 0 ? '취소 (반영 안 함)' : '닫기'}
          </Button>
          <span className="text-ink-4 ml-auto hidden text-[11px] sm:inline">Esc 취소</span>
        </div>
      </div>
    </div>
  )
}
