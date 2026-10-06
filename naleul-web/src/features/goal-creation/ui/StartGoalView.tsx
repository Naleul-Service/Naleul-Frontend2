'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { MessageCircle, Sparkles } from 'lucide-react'
import { Badge, Chip } from '@/components/ui/Chip'
import { isApiError } from '@/lib/client/api'
import { toast } from '@/stores/toastStore'
import { useGoalCategories } from '@/features/goal/api'
import { isKindComplete, subOption, type GoalKindValue } from '@/features/goal/kind'
import { GoalKindPicker } from '@/features/goal/ui/GoalKindPicker'
import { goalCreationApi } from '../api'
import { EXAMPLE_GOALS } from '../constants'
import { ChatComposer } from './ChatComposer'
import { FlowHeader } from './FlowHeader'
import { ResumeCard } from './ResumeCard'

/** /goal/new — 첫 문장 입력 + 이어서 만들기 */
export function StartGoalView({ sourceGoalId }: { sourceGoalId?: number }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [kind, setKind] = useState<GoalKindValue | null>(null)
  const kindReady = isKindComplete(kind)
  const goals = useGoalCategories()
  const source = sourceGoalId ? goals.data?.find((g) => g.goalCategoryId === sourceGoalId) : undefined

  const start = useMutation({
    mutationFn: (initialMessage?: string) => goalCreationApi.start(initialMessage, sourceGoalId, kind),
    onSuccess: (turn) => router.push(`/goal/new/${turn.sessionId}`),
    onError: (error) => toast.error(isApiError(error) ? error.message : '시작하지 못했어요. 다시 시도해 주세요.'),
  })

  const submit = () => {
    const value = text.trim()
    if (value && kindReady && !start.isPending) start.mutate(value)
  }

  // 이동 중에도 버튼이 다시 눌리지 않게 성공 후에도 막아둬요
  const busy = start.isPending || start.isSuccess
  // 고른 2단계에 맞는 예시 (기타·미선택이면 기본 예시)
  // 고른 2단계에 맞는 예시 (미선택이면 기본 예시, "기타"는 사용자가 적은 이름으로)
  const sub = kind ? subOption(kind.goalSubType) : null
  const examples = !sub ? EXAMPLE_GOALS : sub.custom ? [] : sub.examples
  const placeholder = !kindReady
    ? '먼저 카테고리를 골라 주세요'
    : sub?.custom
      ? `예) ${kind!.goalKindLabel?.trim()} 주 3회 꾸준히 하기`
      : `예) ${examples[0]}`

  return (
    <div className="bg-surface flex min-h-dvh flex-col">
      <FlowHeader title="새 목표" onClose={() => router.push('/goal')} />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-12 pb-10 sm:px-6 sm:pt-20">
        <Badge tone="brand" className="self-start">
          <Sparkles className="size-3.5" />
          AI 목표 설계
        </Badge>
        <h1 className="mt-4 text-[28px] leading-tight font-bold tracking-tight sm:text-[32px]">
          어떤 목표를 이루고 싶으세요?
        </h1>
        <p className="text-ink-3 mt-2 text-[15px] leading-relaxed">
          카테고리를 고르면 AI가 그 분야에 맞는 루틴 위주로, 꼭 필요한 것만 담아 계획을 설계해 드려요.
        </p>

        {sourceGoalId && (
          <div className="bg-warning-soft mt-6 rounded-2xl px-4 py-3.5 text-sm text-[#92400e]">
            <p>
              임시 목표{' '}
              <b>
                {source?.emoji ? `${source.emoji} ` : ''}
                {source?.goalCategoryName ?? ''}
              </b>
              을(를) 구체화해요. 목표가 확정되면 거기에 있던 Task와 기록이 새 목표로 옮겨져요.
            </p>
            <button
              type="button"
              onClick={() => start.mutate(undefined)}
              disabled={busy || !kindReady}
              className="mt-2 font-semibold underline-offset-2 hover:underline disabled:opacity-40"
            >
              {kindReady ? '이 이름 그대로 시작하기 →' : '카테고리를 고르면 이 이름 그대로 시작할 수 있어요'}
            </button>
          </div>
        )}

        <section className="mt-8">
          <p className="mb-3 text-[14px] font-semibold">
            <span className="text-brand mr-1.5">1</span>카테고리
          </p>
          <GoalKindPicker value={kind} onChange={setKind} disabled={busy} />
        </section>

        <section className={kindReady ? 'mt-8' : 'pointer-events-none mt-8 opacity-40'}>
          <p className="mb-3 text-[14px] font-semibold">
            <span className="text-brand mr-1.5">2</span>목표를 한 문장으로
          </p>
          <ChatComposer
            value={text}
            onChange={setText}
            onSubmit={submit}
            disabled={busy || !kindReady}
            placeholder={placeholder}
          />

          <div className="mt-4 flex flex-wrap gap-2">
            {examples.map((goal) => (
              <Chip key={goal} size="sm" onClick={() => setText(goal)} disabled={busy || !kindReady}>
                {goal}
              </Chip>
            ))}
          </div>
        </section>

        <button
          type="button"
          onClick={() => start.mutate(undefined)}
          disabled={busy || !kindReady}
          className="text-ink-3 hover:text-ink mt-6 inline-flex items-center gap-1.5 self-start text-sm font-medium disabled:opacity-40"
        >
          <MessageCircle className="size-4" />
          아직 정하지 못했어요. AI가 먼저 물어봐 주세요
        </button>

        <ResumeCard className="mt-auto sm:mt-16" />
      </main>
    </div>
  )
}
