'use client'

import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button, buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Chip'
import { ResumeCard } from '@/features/goal-creation/ui/ResumeCard'
import { useGoalCategories, type GoalCategory } from '../api'
import { dDayLabel, formatDot, goalColor, isOngoing, periodProgress, statusLabel } from '../format'

function GoalCard({ goal }: { goal: GoalCategory }) {
  const period = periodProgress(goal.goalCategoryStartDate, goal.goalCategoryEndDate)
  const routineCount = goal.generalCategories.reduce((n, sg) => n + sg.routines.length, 0)
  const color = goalColor(goal.colorCode)

  return (
    <Link
      href={`/goal/${goal.goalCategoryId}`}
      className="border-line bg-surface hover:border-line-strong group flex flex-col rounded-[20px] border p-5 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
        <Badge
          tone={
            goal.goalCategoryStatus === 'COMPLETED'
              ? 'success'
              : goal.goalCategoryStatus === 'IN_PROGRESS'
                ? 'brand'
                : 'neutral'
          }
          className="h-5 px-2 text-[11px]"
        >
          {statusLabel(goal.goalCategoryStatus)}
        </Badge>
        {period && isOngoing(goal.goalCategoryStatus) && (
          <span className="text-ink-3 ml-auto text-xs font-semibold">{dDayLabel(period.remain)}</span>
        )}
      </div>
      <p className="mt-3 line-clamp-2 text-[17px] leading-snug font-bold">
        {goal.emoji ? `${goal.emoji} ` : ''}
        {goal.goalCategoryName}
      </p>
      {goal.goalCategoryStartDate && (
        <p className="text-ink-3 mt-1 text-[13px]">
          {formatDot(goal.goalCategoryStartDate)} – {formatDot(goal.goalCategoryEndDate)}
        </p>
      )}

      {period && (
        <div className="mt-auto pt-5">
          <div className="text-ink-3 mb-1.5 flex justify-between text-xs">
            <span>기간 경과</span>
            <span className="tabular-nums">{Math.round(period.ratio * 100)}%</span>
          </div>
          <div className="bg-subtle h-1.5 rounded-full">
            <div className="h-full rounded-full" style={{ width: `${period.ratio * 100}%`, backgroundColor: color }} />
          </div>
        </div>
      )}
      <p className="text-ink-3 mt-3 text-xs">
        세부 목표 {goal.generalCategories.length}개 · 루틴 {routineCount}개
      </p>
    </Link>
  )
}

/** /goal — 내 목표 목록 */
export function GoalListView() {
  const { data, isPending, isError, error, refetch } = useGoalCategories()
  const goals = data ?? []
  const ongoing = goals.filter((g) => isOngoing(g.goalCategoryStatus))
  const done = goals.filter((g) => g.goalCategoryStatus === 'COMPLETED')

  return (
    <>
      <PageHeader
        title="목표"
        actions={
          <Link href="/goal/new" className={buttonClass('primary')}>
            <Sparkles className="size-4" />
            AI로 목표 만들기
          </Link>
        }
      />

      <ResumeCard className="mt-6" />

      {isPending && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-surface border-line h-48 animate-pulse rounded-[20px] border" />
          ))}
        </div>
      )}

      {isError && (
        <Card className="mt-6 p-8 text-center">
          <p className="font-bold">목표를 불러오지 못했어요</p>
          <p className="text-ink-3 mt-1 text-sm">{error.message}</p>
          <Button className="mt-4" onClick={() => refetch()}>
            다시 시도
          </Button>
        </Card>
      )}

      {!isPending && !isError && goals.length === 0 && (
        <Card className="mt-6 grid min-h-[320px] place-items-center p-10 text-center">
          <div>
            <p className="text-[17px] font-bold">AI와 대화하며 첫 목표를 설계해 보세요</p>
            <p className="text-ink-3 mt-1.5 text-sm">
              몇 가지 질문에 답하면 세부 목표·마일스톤·루틴까지 계획을 만들어 드려요.
            </p>
            <Link href="/goal/new" className={buttonClass('brand', 'lg') + ' mt-6'}>
              <Sparkles className="size-4" />새 목표 만들기
            </Link>
          </div>
        </Card>
      )}

      {ongoing.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-[15px] font-bold">진행 중 {ongoing.length}</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {ongoing.map((g) => (
              <GoalCard key={g.goalCategoryId} goal={g} />
            ))}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section className="mt-10">
          <h2 className="text-ink-3 mb-3 text-[15px] font-bold">완료 {done.length}</h2>
          <div className="grid gap-4 opacity-80 sm:grid-cols-2 xl:grid-cols-3">
            {done.map((g) => (
              <GoalCard key={g.goalCategoryId} goal={g} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
