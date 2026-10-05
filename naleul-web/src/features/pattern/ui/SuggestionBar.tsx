'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useApplySuggestions, useDismissSuggestions } from '../api'
import type { PatternSuggestionBar, PatternSuggestionItem } from '../types'
import { DAY_SHORT } from '../format'
import { Emphasis } from './Emphasis'

/** 하단 제안 바 + [TimeBlock에 반영하기] 확인 모달 */
export function SuggestionBar({ suggestion }: { suggestion?: PatternSuggestionBar | null }) {
  const [open, setOpen] = useState(false)
  const apply = useApplySuggestions()
  const dismiss = useDismissSuggestions()
  if (!suggestion || !suggestion.items.length) return null
  const keys = suggestion.items.map((i) => i.key)

  return (
    <>
      <section
        className="rounded-card border-line bg-surface shadow-card flex flex-col gap-4 border p-5 sm:flex-row sm:items-center sm:p-6"
        aria-label="패턴 기반 제안"
      >
        <span className="bg-brand grid size-10 shrink-0 place-items-center rounded-xl text-white" aria-hidden>
          <Sparkles className="size-5" />
        </span>
        <p className="text-ink-2 min-w-0 flex-1 text-[15px] leading-relaxed">
          <Emphasis text={suggestion.text} className="text-brand" />
        </p>
        <div className="flex shrink-0 gap-2">
          <Button size="lg" onClick={() => setOpen(true)}>
            TimeBlock에 반영하기
          </Button>
          <Button size="lg" variant="secondary" loading={dismiss.isPending} onClick={() => dismiss.mutate(keys)}>
            다음에
          </Button>
        </div>
      </section>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        dismissible={!apply.isPending}
        title="이렇게 바꿀게요"
        description="내일부터 적용돼요. 지난 기록과 오늘 일정은 그대로예요."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={apply.isPending}>
              취소
            </Button>
            <Button
              variant="brand"
              loading={apply.isPending}
              onClick={() => apply.mutate(keys, { onSettled: () => setOpen(false) })}
            >
              반영하기
            </Button>
          </>
        }
      >
        <ul className="flex flex-col gap-3">
          {suggestion.items.map((item) => (
            <ChangeRow key={item.key} item={item} />
          ))}
        </ul>
        <p className="text-ink-3 mt-4 text-[13px] leading-relaxed">
          그날만 직접 옮긴 블록은 그대로 두고, 새 시간과 겹치는 자동 배치 블록은 다시 배치해요.
        </p>
      </Modal>
    </>
  )
}

function ChangeRow({ item }: { item: PatternSuggestionItem }) {
  const isTime = item.type === 'ROUTINE_TIME'
  const before = isTime
    ? `${item.before.startTime ?? ''}–${item.before.endTime ?? ''}`
    : (item.before.days ?? []).map((d) => DAY_SHORT[d]).join('·')
  const after = isTime
    ? `${item.after.startTime ?? ''}–${item.after.endTime ?? ''}`
    : (item.after.days ?? []).map((d) => DAY_SHORT[d]).join('·')
  return (
    <li className="bg-subtle rounded-2xl px-4 py-3">
      <p className="text-[15px] font-bold">{item.routineName}</p>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-[14px]">
        <span className="text-ink-3">{isTime ? '시간' : '요일'}</span>
        <span className="text-ink-4 line-through">{before}</span>
        <span aria-label="에서">→</span>
        <span className="text-brand font-bold">{after}</span>
      </p>
    </li>
  )
}
