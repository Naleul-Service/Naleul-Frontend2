'use client'

import Link from 'next/link'
import { ArrowRight, Plus, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button, buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Chip'
import { ResumeCard } from '@/features/goal-creation/ui/ResumeCard'
import { useRecordPattern } from '@/features/record/api'
import { useGoalCategories, type GoalCategory } from '../api'
import { dDayLabel, formatDot, goalColor, isOngoing, periodProgress, statusLabel } from '../format'
import { subOption } from '../kind'
import { refineHref } from './RefineWithAiCard'

/** 임시 목표 카드 — 보기 / AI로 구체화하기 */
function TempGoalCard({ goal }: { goal: GoalCategory }) {
  const subCount = goal.generalCategories.filter((g) => g.generalCategoryStatus !== 'DELETED').length
  return (
    <div className="border-warning/40 bg-warning-soft/40 flex flex-col rounded-[20px] border border-dashed p-5">
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: goalColor(goal.colorCode) }} />
        <Badge tone="warning" className="h-5 px-2 text-[11px]">
          임시 목표
        </Badge>
      </div>
      <Link
        href={`/goal/${goal.goalCategoryId}`}
        className="mt-3 line-clamp-2 text-[17px] leading-snug font-bold hover:underline"
      >
        {goal.emoji ? `${goal.emoji} ` : ''}
        {goal.goalCategoryName}
      </Link>
      <p className="text-ink-3 mt-1 text-[13px]">
        Task를 적다가 만들어진 목표예요{subCount ? ` · 세부 목표 ${subCount}개` : ''}
      </p>
      <Link href={refineHref(goal)} className={buttonClass('brand', 'sm') + ' mt-auto self-start'}>
        <Sparkles className="size-3.5" />
        AI로 구체화하기
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  )
}

const fmtValue = (v: number, unit: string | null | undefined) => `${Number(v.toFixed(2))}${unit ?? ''}`

/** 생활형 수치 목표 — 시작 → 목표 사이 지금 위치 + 남은 수치 */
function metricProgress(goal: GoalCategory) {
  const { startValue: start, currentValue, targetValue: target } = goal
  if (start == null || target == null || start === target) return null
  const current = currentValue ?? start
  const ratio = Math.min(Math.max((current - start) / (target - start), 0), 1)
  return {
    current,
    target,
    ratio,
    remain: Math.abs(target - current),
    done: ratio >= 1,
  }
}

function ProgressBar({ ratio, color }: { ratio: number; color: string }) {
  return (
    <div className="bg-subtle h-1.5 rounded-full">
      <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, backgroundColor: color }} />
    </div>
  )
}

/** 생활형: 수치가 있으면 목표까지 남은 수치, 없으면 기간 경과 */
function LifeProgress({ goal, color }: { goal: GoalCategory; color: string }) {
  const metric = metricProgress(goal)
  const period = periodProgress(goal.goalCategoryStartDate, goal.goalCategoryEndDate)
  const unit = goal.metricUnit

  if (metric) {
    return (
      <div className="mt-auto pt-5">
        <div className="mb-1.5 flex items-end justify-between gap-2 text-xs">
          <span className="text-ink-3">
            {goal.metricName ? `${goal.metricName} ` : ''}
            <b className="text-ink">{fmtValue(metric.current, unit)}</b> → {fmtValue(metric.target, unit)}
          </span>
          <span className="font-semibold tabular-nums">{Math.round(metric.ratio * 100)}%</span>
        </div>
        <ProgressBar ratio={metric.ratio} color={color} />
        <p className="mt-1.5 text-xs font-semibold" style={{ color: metric.done ? undefined : color }}>
          {metric.done ? '목표 달성 🎉' : `목표까지 ${fmtValue(metric.remain, unit)} 남았어요`}
        </p>
      </div>
    )
  }

  if (!period) return null
  return (
    <div className="mt-auto pt-5">
      <div className="text-ink-3 mb-1.5 flex justify-between text-xs">
        <span>기간 경과</span>
        <span className="tabular-nums">{Math.round(period.ratio * 100)}%</span>
      </div>
      <ProgressBar ratio={period.ratio} color={color} />
    </div>
  )
}

/** 업무형: 완료한 Task 가 있는 주가 몇 주째 이어지는지 + 최근 8주 칸 */
function WorkStreak({ goalId, color }: { goalId: number; color: string }) {
  const { data } = useRecordPattern(goalId)
  if (!data)
    return (
      <div className="mt-auto pt-5">
        <div className="bg-subtle h-12 animate-pulse rounded-lg" />
      </div>
    )

  const { weekStreak, thisWeekDone } = data.summary
  const weeks = data.rhythm.weeks.slice(-8)
  return (
    <div className="mt-auto pt-5">
      <div className="mb-1.5 flex items-end justify-between gap-2 text-xs">
        <span className="text-ink-3">연속 완료</span>
        <span className="font-semibold tabular-nums">
          {weekStreak > 0 && <span aria-hidden>🔥 </span>}
          {weekStreak}주
        </span>
      </div>
      <div className="flex gap-1" aria-hidden>
        {weeks.map((w) => (
          <span
            key={w.weekStart}
            className="bg-subtle h-1.5 flex-1 rounded-full"
            style={w.count > 0 ? { backgroundColor: color } : undefined}
          />
        ))}
      </div>
      <p className="text-ink-3 mt-1.5 text-xs">
        {thisWeekDone
          ? '이번 주도 완료했어요'
          : weekStreak > 0
            ? `이번 주에 하나 끝내면 ${weekStreak + 1}주째예요`
            : '이번 주에 첫 칸을 채워보세요'}
      </p>
    </div>
  )
}

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
        {goal.goalMode === 'RECORD' && (
          <Badge tone="neutral" className="h-5 px-2 text-[11px]">
            업무형
          </Badge>
        )}
        {goal.pausedDays != null && (
          <Badge tone="warning" className="h-5 px-2 text-[11px]">
            멈춤 {goal.pausedDays}일째
          </Badge>
        )}
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
          {formatDot(goal.goalCategoryStartDate)} –{' '}
          {goal.goalCategoryEndDate ? formatDot(goal.goalCategoryEndDate) : '계속'}
        </p>
      )}

      {goal.goalMode === 'RECORD' ? (
        <WorkStreak goalId={goal.goalCategoryId} color={color} />
      ) : (
        <LifeProgress goal={goal} color={color} />
      )}
      <p className="text-ink-3 mt-3 text-xs">
        {goal.goalMode === 'RECORD'
          ? `${goal.goalType === 'WORK' && goal.goalSubType ? subOption(goal.goalSubType).label : '업무형'} · 완료한 Task를 쌓는 목표${routineCount ? ` · 루틴 ${routineCount}개` : ''}`
          : `세부 목표 ${goal.generalCategories.length}개 · 루틴 ${routineCount}개`}
      </p>
    </Link>
  )
}

/** /goal — 내 목표 목록 */
export function GoalListView() {
  const { data, isPending, isError, error, refetch } = useGoalCategories()
  const goals = data ?? []
  const temps = goals.filter((g) => g.temporary && isOngoing(g.goalCategoryStatus))
  const ongoing = goals.filter((g) => !g.temporary && isOngoing(g.goalCategoryStatus))
  const done = goals.filter((g) => g.goalCategoryStatus === 'COMPLETED')

  return (
    <>
      <PageHeader
        title="목표"
        actions={
          <Link href="/goal/add" className={buttonClass('primary')}>
            <Plus className="size-4" strokeWidth={2.6} />
            목표 추가
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
            <p className="text-[17px] font-bold">첫 목표를 만들어 보세요</p>
            <p className="text-ink-3 mt-1.5 text-sm">
              AI와 대화하며 계획까지 설계하거나, 이미 정한 계획이 있다면 직접 만들 수 있어요.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link href="/goal/new" className={buttonClass('brand', 'lg')}>
                <Sparkles className="size-4" />
                AI로 설계하기
              </Link>
              <Link href="/goal/add?mode=manual" className={buttonClass('secondary', 'lg')}>
                직접 만들기
              </Link>
            </div>
          </div>
        </Card>
      )}

      {temps.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-1 text-[15px] font-bold">임시 목표 {temps.length}</h2>
          <p className="text-ink-3 mb-3 text-[13px]">
            AI로 구체화하면 기간·마일스톤·루틴이 생기고, 지금 있는 Task는 그대로 옮겨져요.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {temps.map((g) => (
              <TempGoalCard key={g.goalCategoryId} goal={g} />
            ))}
          </div>
        </section>
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
