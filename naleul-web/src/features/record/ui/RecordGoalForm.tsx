'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useUserColors } from '@/features/color/api'
import { ColorSwatches, Field, InlineForm, inlineInput } from '@/features/goal/edit/inline'
import { useCreateRecordGoal } from '../api'

/** 이름 예시 — 누르면 이름과 이모지가 같이 채워져요. 업무형은 종류를 나누지 않아요 (회사 · 취업 · 동아리 …) */
const EXAMPLES: { emoji: string; name: string }[] = [
  { emoji: '💼', name: '회사 업무' },
  { emoji: '🎯', name: '취업 준비' },
  { emoji: '🚀', name: '사이드 프로젝트' },
  { emoji: '🎸', name: '동아리 활동' },
  { emoji: '🌍', name: '대외활동' },
  { emoji: '📚', name: '스터디 운영' },
  { emoji: '🎓', name: '졸업 프로젝트' },
]

const EMOJIS = ['💼', '🎯', '🚀', '🎸', '🌍', '📚', '🎓', '🧑‍💻', '📊', '✍️']

/**
 * 업무형 목표 만들기 (goal_mode = RECORD).
 * 회사 업무 · 취업 준비 · 동아리처럼 종류가 다양해서 종류를 고르지 않고 이름만 받아요.
 * 기한 · 수치 · 세부 목표도 묻지 않아요 — 만든 뒤 주제마다 마감을 정하면 로드맵이 그려져요.
 */
export function RecordGoalForm({ onCancel, className }: { onCancel: () => void; className?: string }) {
  const router = useRouter()
  const colors = useUserColors()
  const create = useCreateRecordGoal()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState(EXAMPLES[0].emoji)
  const [colorId, setColorId] = useState<number | null>(null)
  const [styleOpen, setStyleOpen] = useState(false)
  const value = name.trim()

  const submit = () =>
    create.mutate(
      { name: value, emoji, colorId, description: description.trim() || null },
      { onSuccess: (goal) => router.push(`/goal/${goal.goalCategoryId}`) }
    )

  return (
    <InlineForm
      onSubmit={submit}
      onCancel={onCancel}
      saving={create.isPending}
      valid={!!value}
      error={null}
      submitLabel="업무형 목표 만들기"
      className={className}
    >
      {/* ① 이름 */}
      <Field label="이름">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="예: 취업 준비 · 동아리 활동 · OO팀 업무"
          className={inlineInput}
          data-autofocus
        />
      </Field>
      <div className="-mt-1 flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.name}
            type="button"
            onClick={() => {
              setName(ex.name)
              setEmoji(ex.emoji)
            }}
            className="border-line text-ink-3 hover:border-line-strong hover:text-ink-2 h-7 rounded-full border px-2.5 text-[12px]"
          >
            {ex.emoji} {ex.name}
          </button>
        ))}
      </div>

      {/* ② 한 줄 설명 */}
      <Field label="무엇을 하나요? (선택)">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={100}
          placeholder="예: 하반기 백엔드 개발자 공채 지원"
          className={inlineInput}
        />
      </Field>

      {/* ③ 꾸미기 — 기본값이 있어서 접어 둬요 */}
      <div>
        <button
          type="button"
          onClick={() => setStyleOpen((v) => !v)}
          aria-expanded={styleOpen}
          className="text-ink-2 hover:text-ink flex items-center gap-1.5 text-[13px] font-semibold"
        >
          <span className="text-base" aria-hidden>
            {emoji}
          </span>
          이모지·색상 바꾸기
          <ChevronDown className={cn('size-4 transition-transform', styleOpen && 'rotate-180')} />
        </button>
        {styleOpen && (
          <div className="mt-2 space-y-3">
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
            <Field label="색상 (선택 안 하면 자동)">
              <ColorSwatches colors={colors.data} value={colorId} onChange={setColorId} />
            </Field>
          </div>
        )}
      </div>

      {/* 예시 — 만든 뒤 어떻게 쓰는지 */}
      <p className="bg-subtle text-ink-2 rounded-xl px-3 py-2.5 text-[13px] leading-relaxed">
        전체 마감 없이 만들어요. 만든 뒤 <b>포트폴리오 → 이력서 제출 → 면접</b>처럼 주제마다 마감을 정하면 마감 순서대로
        로드맵이 그려지고, 주제마다 남은 할 일을 체크해요.
      </p>
    </InlineForm>
  )
}
