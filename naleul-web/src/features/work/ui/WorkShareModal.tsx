'use client'

import { useState } from 'react'
import { Copy, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { toast } from '@/stores/toastStore'
import { useWorkShareText, type ShareScope } from '../api'

const SCOPES: { value: ShareScope; label: string; hint: string }[] = [
  { value: 'TODAY', label: '오늘 할 일', hint: '오늘 할 일 + 오늘 끝낸 일' },
  { value: 'REMAINING', label: '남은 일', hint: '진행 중 + 시작 전 (주제별)' },
  { value: 'ALL', label: '전체', hint: '남은 일 + 최근 7일 완료' },
]

/**
 * 공유하기 — 서버가 정리해 준 텍스트를 카톡 · 슬랙에 붙여 넣기 좋게 보여주고 복사 · 공유해요.
 * 휴대폰 브라우저에서는 시스템 공유 창(navigator.share)으로 바로 보낼 수 있어요.
 */
export function WorkShareModal({ goalId, open, onClose }: { goalId: number; open: boolean; onClose: () => void }) {
  const [scope, setScope] = useState<ShareScope>('REMAINING')
  const { data, isFetching, isError, error } = useWorkShareText(goalId, scope, open)
  const text = data?.text ?? ''
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('복사했어요. 원하는 곳에 붙여 넣어 주세요.')
    } catch {
      toast.error('복사하지 못했어요. 글을 길게 눌러 직접 복사해 주세요.')
    }
  }
  const share = async () => {
    try {
      await navigator.share({ text })
    } catch {
      // 사용자가 공유 창을 닫은 경우 — 아무것도 안 해요
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Task 공유하기"
      description="팀 채팅방에 붙여 넣기 좋게 정리했어요."
      size="lg"
      footer={
        <>
          {canShare && (
            <Button variant="secondary" onClick={share} disabled={!text}>
              <Share2 className="size-4" />
              공유
            </Button>
          )}
          <Button onClick={copy} disabled={!text}>
            <Copy className="size-4" />
            복사하기
          </Button>
        </>
      }
    >
      <div className="bg-subtle inline-flex rounded-xl p-1" role="radiogroup" aria-label="공유할 범위">
        {SCOPES.map((s) => (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={scope === s.value}
            title={s.hint}
            onClick={() => setScope(s.value)}
            className={cn(
              'h-8 rounded-lg px-3 text-[13px] font-semibold transition-colors',
              scope === s.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="text-ink-3 mt-1.5 text-[12px]">{SCOPES.find((s) => s.value === scope)?.hint}</p>
      <div className="border-line bg-canvas relative mt-3 min-h-[160px] rounded-2xl border p-4">
        {isFetching && !text ? (
          <div className="grid h-32 place-items-center">
            <Spinner className="text-ink-3 size-5" />
          </div>
        ) : isError ? (
          <p className="text-danger text-sm">{error.message}</p>
        ) : (
          <pre className="font-sans text-[13px] leading-relaxed whitespace-pre-wrap select-all">{text}</pre>
        )}
      </div>
    </Modal>
  )
}
