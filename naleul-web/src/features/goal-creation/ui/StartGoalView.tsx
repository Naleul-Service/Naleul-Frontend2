'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { ArrowRight, MessageCircle, NotebookPen, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge, Chip } from '@/components/ui/Chip'
import { isApiError } from '@/lib/client/api'
import { toast } from '@/stores/toastStore'
import { useGoalCategories } from '@/features/goal/api'
import { MUST_DO_SUGGESTIONS, isKindComplete, subOption, type GoalKindValue } from '@/features/goal/kind'
import { GoalKindPicker } from '@/features/goal/ui/GoalKindPicker'
import { useAiUsage, useRefreshUsage, usageItem } from '@/features/usage/api'
import { UsageLine } from '@/features/usage/ui/UsageLine'
import { goalCreationApi } from '../api'
import { EXAMPLE_GOALS } from '../constants'
import { MustDoPicker, withDraft } from './MustDoPicker'
import { FlowHeader } from './FlowHeader'
import { ResumeCard } from './ResumeCard'

/** /goal/new — 첫 문장 입력 + 이어서 만들기 */
export function StartGoalView({ sourceGoalId }: { sourceGoalId?: number }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [kind, setKind] = useState<GoalKindValue | null>(null)
  // 이 목표를 위해 꼭 하고 싶은 일 (예: 다이어트 → 헬스 · 식단 기록) — 계획에 반드시 루틴으로 들어가요
  const [mustDo, setMustDo] = useState<string[]>([])
  // 입력창에 적어 두기만 한 일도 함께 보내요 (하나만 할 거면 "+ 추가"를 안 눌러도 돼요)
  const [mustDoDraft, setMustDoDraft] = useState('')
  const mustDoInput = useRef<HTMLInputElement>(null)
  const kindReady = isKindComplete(kind)
  const goals = useGoalCategories()
  const source = sourceGoalId ? goals.data?.find((g) => g.goalCategoryId === sourceGoalId) : undefined

  // 오늘 남은 횟수 (AI 목표 만들기 · 계획 초안) — 다 쓰면 시작 버튼을 막고 미리 알려줘요
  const usage = useAiUsage()
  const refreshUsage = useRefreshUsage()
  const sessionLeft = usageItem(usage.data, 'GOAL_SESSION')
  const draftLeft = usageItem(usage.data, 'GOAL_DRAFT')
  const outOfQuota = sessionLeft?.remaining === 0 || draftLeft?.remaining === 0

  const start = useMutation({
    mutationFn: (initialMessage?: string) =>
      goalCreationApi.start(initialMessage, sourceGoalId, kind, withDraft(mustDo, mustDoDraft)),
    onSuccess: (turn) => {
      refreshUsage()
      router.push(`/goal/new/${turn.sessionId}`)
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : '시작하지 못했어요. 다시 시도해 주세요.'),
  })

  const goalText = text.trim()
  const submit = () => {
    if (goalText && kindReady && !start.isPending && !outOfQuota) start.mutate(goalText)
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

        {/* 회사 업무처럼 수치·마감이 없는 일은 AI 설계가 오히려 뜬구름이 돼요 → 업무형으로 안내 */}
        {!sourceGoalId && (
          <Link
            href="/goal/add?mode=record"
            className="border-line bg-surface hover:border-line-strong group mt-6 flex items-center gap-3 rounded-2xl border px-4 py-3"
          >
            <span className="bg-ink grid size-9 shrink-0 place-items-center rounded-xl text-on-ink">
              <NotebookPen className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold">회사 업무나 사이드 프로젝트인가요?</span>
              <span className="text-ink-3 block text-[13px]">
                AI 설계 없이 바로 만들고, 완료한 Task로 업무 일지를 쌓는 업무형 목표가 더 잘 맞아요.
              </span>
            </span>
            <ArrowRight className="text-ink-3 size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}

        {sourceGoalId && (
          <div className="bg-warning-soft mt-6 rounded-2xl px-4 py-3.5 text-sm text-warning-ink-strong">
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
            <span className="text-brand mr-1.5">2</span>이루고 싶은 목표를 작성해 주세요
          </p>
          {/* Enter 는 바로 시작하지 않고 다음 질문(꼭 해야 할 일)으로 넘어가요 */}
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault()
                mustDoInput.current?.focus()
              }
            }}
            maxLength={100}
            disabled={busy || !kindReady}
            placeholder={placeholder}
            aria-label="이루고 싶은 목표"
            className="border-line-strong bg-surface placeholder:text-ink-4 focus:border-ink-3 disabled:bg-subtle h-12 w-full rounded-2xl border px-4 text-[15px] outline-none"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {examples.map((goal) => (
              <Chip key={goal} size="sm" onClick={() => setText(goal)} disabled={busy || !kindReady}>
                {goal}
              </Chip>
            ))}
          </div>
        </section>

        <section className={kindReady ? 'mt-8' : 'pointer-events-none mt-8 opacity-40'}>
          <p className="text-[14px] font-semibold">
            <span className="text-brand mr-1.5">3</span>
            {goalText ? (
              <>
                <span className="text-brand">
                  &ldquo;{goalText.length > 24 ? `${goalText.slice(0, 24)}…` : goalText}&rdquo;
                </span>{' '}
                목표를 이루기 위해 꼭 해야 할 일들이 있나요?
              </>
            ) : (
              '이 목표를 이루기 위해 꼭 해야 할 일들이 있나요?'
            )}{' '}
            <span className="text-ink-3 font-normal">(선택)</span>
          </p>
          <p className="text-ink-3 mt-1 mb-3 text-[13px]">
            하나면 적기만 하면 되고, 여러 개면 &lsquo;+ 추가&rsquo;로 더 적어 주세요. 고른 일은 계획에 꼭 넣어 드려요.
          </p>
          <MustDoPicker
            value={mustDo}
            onChange={setMustDo}
            draft={mustDoDraft}
            onDraftChange={setMustDoDraft}
            inputRef={mustDoInput}
            suggestions={kind ? (MUST_DO_SUGGESTIONS[kind.goalSubType] ?? []) : []}
            disabled={busy || !kindReady}
          />
        </section>

        <Button
          size="lg"
          variant="brand"
          className="mt-8 w-full"
          onClick={submit}
          loading={start.isPending}
          disabled={busy || !kindReady || !goalText || outOfQuota}
        >
          <Sparkles className="size-4" />
          AI와 목표 설계 시작하기
        </Button>
        <UsageLine className="mt-2 justify-center" items={[sessionLeft, draftLeft]} />
        {outOfQuota && (
          <p className="text-danger mt-1 text-center text-[13px] font-semibold">
            오늘 AI 목표 만들기 횟수를 모두 썼어요. 내일 0시에 다시 채워져요 — 지금은 직접 만들기를 쓸 수 있어요.
          </p>
        )}

        <button
          type="button"
          onClick={() => start.mutate(undefined)}
          disabled={busy || !kindReady || outOfQuota}
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
