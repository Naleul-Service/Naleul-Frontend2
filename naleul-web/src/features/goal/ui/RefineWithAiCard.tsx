import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import type { GoalCategory } from '../api'

export const refineHref = (goal: GoalCategory) => `/goal/new?sourceGoalId=${goal.goalCategoryId}`

/**
 * 임시 목표 → AI 목표로 구체화하기 유도.
 * 임시 목표는 Brain dump 가 대충 만든 그릇이라 기간·마일스톤·루틴이 없어요.
 * 구체화를 확정하면 지금 있는 Task 와 기록은 새 목표로 그대로 옮겨져요 (백엔드 BE-8).
 */
export function RefineWithAiCard({ goal, className }: { goal: GoalCategory; className?: string }) {
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
          아직 임시 목표예요. 몇 가지 질문에 답하면 기간·마일스톤·루틴까지 설계해 드려요. 지금 있는 Task와 기록은 그대로
          옮겨져요.
        </p>
      </div>
      <Link href={refineHref(goal)} className={cn(buttonClass('brand', 'lg'), 'shrink-0')}>
        AI로 구체화하기
        <ArrowRight className="size-4" />
      </Link>
    </section>
  )
}
