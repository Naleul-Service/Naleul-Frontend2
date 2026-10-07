'use client'

import Link from 'next/link'
import { ArrowRight, NotebookPen, Sparkles } from 'lucide-react'
import { Button, buttonClass } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { useKeepAsRecord } from '@/features/record/api'
import type { GoalCategory } from '../api'

export const refineHref = (goal: GoalCategory) => `/goal/new?sourceGoalId=${goal.goalCategoryId}`

/**
 * 임시 목표 → AI 목표로 구체화하기 유도.
 * 임시 목표는 Brain dump 가 대충 만든 그릇이라 기간·마일스톤·루틴이 없어요.
 * 구체화를 확정하면 지금 있는 Task 와 기록은 새 목표로 그대로 옮겨져요 (백엔드 BE-8).
 */
export function RefineWithAiCard({ goal, className }: { goal: GoalCategory; className?: string }) {
  // 회사 업무처럼 "이룰 것"이 없는 일은 구체화할 필요 없이 기록형으로 두는 게 맞아요
  const keep = useKeepAsRecord(goal.goalCategoryId)
  const name = `${goal.emoji ? `${goal.emoji} ` : ''}${goal.goalCategoryName}`
  return (
    <section
      className={cn(
        'border-brand/20 from-brand-soft flex flex-col gap-4 rounded-[20px] border bg-gradient-to-br to-white p-5 sm:flex-row sm:items-center sm:p-6',
        className
      )}
    >
      <span className="bg-brand grid size-11 shrink-0 place-items-center rounded-2xl text-white">
        <Sparkles className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[17px] leading-snug font-bold">AI로 &lsquo;{name}&rsquo; 목표를 구체화해 볼까요?</p>
        <p className="text-ink-3 mt-1 text-sm leading-relaxed">
          아직 임시 목표예요. 몇 가지 질문에 답하면 기간·점검 시점·루틴까지 설계해 드려요. 지금 있는 Task와 기록은
          그대로 옮겨져요. 업무처럼 기록만 쌓을 일이라면 기록형으로 두면 돼요.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button variant="secondary" size="lg" onClick={() => keep.mutate()} loading={keep.isPending}>
          <NotebookPen className="size-4" />
          기록형으로 두기
        </Button>
        <Link href={refineHref(goal)} className={buttonClass('brand', 'lg')}>
          AI로 구체화하기
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  )
}
