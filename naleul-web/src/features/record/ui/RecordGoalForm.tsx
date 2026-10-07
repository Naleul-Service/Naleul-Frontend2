'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/cn'
import { useUserColors } from '@/features/color/api'
import { ColorSwatches, Field, InlineForm, inlineInput } from '@/features/goal/edit/inline'
import { useCreateRecordGoal } from '../api'

const EMOJIS = ['💼', '🧑‍💻', '📊', '🗂️', '🎨', '✍️', '🤝', '🏠']
const NAME_EXAMPLES = ['나를 업무', '회사 프로젝트', '사이드 프로젝트', '육아 기록']

/**
 * 기록형 목표 만들기 — 이름만 있으면 끝 (Enter 로 만들기).
 * 수치·기간·세부 목표를 묻지 않아요. 회사 업무처럼 "한 일을 쌓는" 목표에 맞춰서
 * 만들자마자 상세 화면에서 오늘 한 일을 적을 수 있게 해요.
 */
export function RecordGoalForm({ onCancel, className }: { onCancel: () => void; className?: string }) {
  const router = useRouter()
  const colors = useUserColors()
  const create = useCreateRecordGoal()
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(EMOJIS[0])
  const [colorId, setColorId] = useState<number | null>(null)

  const value = name.trim()
  const submit = () =>
    create.mutate({ name: value, emoji, colorId }, { onSuccess: (goal) => router.push(`/goal/${goal.goalCategoryId}`) })

  return (
    <InlineForm
      onSubmit={submit}
      onCancel={onCancel}
      saving={create.isPending}
      valid={!!value}
      error={null}
      submitLabel="기록형 목표 만들기"
      className={className}
    >
      <Field label="이름">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder={`예: ${NAME_EXAMPLES[0]}`}
          className={inlineInput}
          data-autofocus
        />
      </Field>
      <div className="flex flex-wrap gap-1.5">
        {NAME_EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setName(ex)}
            className="border-line text-ink-3 hover:border-line-strong hover:text-ink-2 h-7 rounded-full border px-2.5 text-[12px]"
          >
            {ex}
          </button>
        ))}
      </div>
      <div>
        <span className="text-ink-3 mb-1 block text-[12px] font-medium">이모지</span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="이모지">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={emoji === e}
              onClick={() => setEmoji(e)}
              className={cn(
                'grid size-9 place-items-center rounded-xl border text-lg',
                emoji === e ? 'border-ink bg-subtle' : 'border-line hover:border-line-strong'
              )}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
      <Field label="색상 (선택 안 하면 자동)">
        <ColorSwatches colors={colors.data} value={colorId} onChange={setColorId} />
      </Field>
      <p className="text-ink-3 text-xs">
        기간·수치·점검 시점 없이 만들어요. 상세 화면에서 &ldquo;오늘 한 일&rdquo;을 한 줄씩 쌓고, 필요하면 반복 루틴도
        붙일 수 있어요.
      </p>
    </InlineForm>
  )
}
