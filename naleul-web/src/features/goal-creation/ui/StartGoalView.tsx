'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { MessageCircle, Sparkles } from 'lucide-react'
import { Badge, Chip } from '@/components/ui/Chip'
import { isApiError } from '@/lib/client/api'
import { toast } from '@/stores/toastStore'
import { useGoalCategories } from '@/features/goal/api'
import { goalCreationApi } from '../api'
import { EXAMPLE_GOALS } from '../constants'
import { ChatComposer } from './ChatComposer'
import { FlowHeader } from './FlowHeader'
import { ResumeCard } from './ResumeCard'

/** /goal/new — 첫 문장 입력 + 이어서 만들기 */
export function StartGoalView({ sourceGoalId }: { sourceGoalId?: number }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const goals = useGoalCategories()
  const source = sourceGoalId ? goals.data?.find((g) => g.goalCategoryId === sourceGoalId) : undefined

  const start = useMutation({
    mutationFn: (initialMessage?: string) => goalCreationApi.start(initialMessage, sourceGoalId),
    onSuccess: (turn) => router.push(`/goal/new/${turn.sessionId}`),
    onError: (error) => toast.error(isApiError(error) ? error.message : '시작하지 못했어요. 다시 시도해 주세요.'),
  })

  const submit = () => {
    const value = text.trim()
    if (value && !start.isPending) start.mutate(value)
  }

  // 이동 중에도 버튼이 다시 눌리지 않게 성공 후에도 막아둬요
  const busy = start.isPending || start.isSuccess

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
          한 문장이면 충분해요. AI가 몇 가지만 물어보고 계획을 함께 설계해 드려요.
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
              disabled={busy}
              className="mt-2 font-semibold underline-offset-2 hover:underline disabled:opacity-40"
            >
              이 이름 그대로 시작하기 →
            </button>
          </div>
        )}

        <div className="mt-8">
          <ChatComposer
            value={text}
            onChange={setText}
            onSubmit={submit}
            disabled={busy}
            autoFocus
            placeholder="예) 6개월 안에 10kg 빼고 싶어"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {EXAMPLE_GOALS.map((goal) => (
            <Chip key={goal} size="sm" onClick={() => setText(goal)} disabled={busy}>
              {goal}
            </Chip>
          ))}
        </div>

        <button
          type="button"
          onClick={() => start.mutate(undefined)}
          disabled={busy}
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
