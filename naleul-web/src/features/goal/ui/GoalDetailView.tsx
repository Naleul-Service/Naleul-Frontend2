'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { isApiError } from '@/lib/client/api'
import { RecordHero } from '@/features/record/ui/RecordHero'
import { RecordQuickLog } from '@/features/record/ui/RecordQuickLog'
import { RecordTimeline } from '@/features/record/ui/RecordTimeline'
import { useGoalActivities } from '@/features/record/api'
import { isRecordGoal, useGoalCategory, type GoalCategory } from '../api'
import { EditingContext } from '../edit/inline'
import { dDayLabel, periodProgress } from '../format'
import { GoalAiEditBar } from './GoalAiEditBar'
import { GoalHeader, GoalNotes } from './GoalHeader'
import { GoalTaskList } from './GoalTaskList'
import { PlaceAfterCreateCard } from './PlaceAfterCreateCard'
import { ProgressSection } from './progress/ProgressSection'
import { RefineWithAiCard } from './RefineWithAiCard'
import { RoutineHeatmapSection } from './RoutineHeatmapSection'
import { RoutinesSection } from './RoutinesSection'
import { Section } from './sections'
import { StructurePanel } from './StructurePanel'
import { TaskRateSection } from './TaskRateSection'

// ─── 작은 조각들 ───────────────────────────────────────────────

function Ring({ ratio, label }: { ratio: number; label: string }) {
  const R = 52
  const C = 2 * Math.PI * R
  return (
    <div className="relative size-32 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" stroke="white" strokeOpacity="0.25" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke="white"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - Math.min(Math.max(ratio, 0), 1))}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[26px] font-bold">{label}</span>
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[120px] flex-1 rounded-2xl bg-white/15 px-4 py-3">
      <p className="text-xs text-white/75">{label}</p>
      <p className="mt-0.5 text-xl font-bold whitespace-nowrap">{value}</p>
    </div>
  )
}

// ─── 영역별 ────────────────────────────────────────────────────

function Hero({ goal }: { goal: GoalCategory }) {
  const period = periodProgress(goal.goalCategoryStartDate, goal.goalCategoryEndDate)
  const hasMetric = goal.targetValue != null && goal.startValue != null
  const unit = goal.metricUnit ?? ''

  // 수치 목표면 수치 진행률, 아니면 기간 경과율
  let ratio = period?.ratio ?? 0
  let caption = '기간 경과'
  let headline = period ? `${period.elapsed}일째` : '-'
  if (hasMetric) {
    const current = goal.currentValue ?? goal.startValue!
    const span = goal.targetValue! - goal.startValue!
    ratio = span === 0 ? 1 : (current - goal.startValue!) / span
    caption = `목표까지 남은 ${goal.metricName ?? ''}`.trim()
    headline = `${Math.abs(goal.targetValue! - current)
      .toFixed(1)
      .replace(/\.0$/, '')}${unit}`
  }

  return (
    <section className="bg-brand flex flex-col gap-6 rounded-[24px] p-6 text-white sm:p-8 lg:flex-row lg:items-center">
      <div className="flex items-center gap-6">
        <Ring ratio={ratio} label={`${Math.round(Math.min(Math.max(ratio, 0), 1) * 100)}%`} />
        <div>
          <p className="text-sm text-white/80">{caption}</p>
          <p className="mt-1 text-[40px] leading-none font-bold tracking-tight">{headline}</p>
        </div>
      </div>
      {period && (
        <div className="flex flex-1 flex-wrap gap-3 lg:justify-end">
          {hasMetric && <StatBox label="현재" value={`${goal.currentValue ?? goal.startValue}${unit}`} />}
          <StatBox label="경과" value={`${period.elapsed} / ${period.total}일`} />
          <StatBox label="남은 기간" value={dDayLabel(period.remain)} />
        </div>
      )}
    </section>
  )
}

// ─── 기록형 목표 ───────────────────────────────────────────────

/**
 * 기록형 목표 (회사 업무 등) — 진행률·마일스톤 대신 "한 일"을 쌓아 보여줘요.
 *  - 상단: 이번 주 쌓인 시간
 *  - 왼쪽: 오늘 한 일 한 줄 기록 + 날짜별 타임라인
 *  - 오른쪽: (선택) 반복 루틴 · Task — 주간 회의처럼 반복되는 일만 필요할 때 붙여요
 */
function RecordGoalBody({ goal }: { goal: GoalCategory }) {
  const activities = useGoalActivities(goal.goalCategoryId)
  const list = activities.data ?? []
  return (
    <>
      <div className="mt-6">
        <RecordHero activities={list} />
      </div>
      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-5">
          <RecordQuickLog goal={goal} />
          <RecordTimeline activities={list} loading={activities.isPending} />
        </div>
        <div className="space-y-5">
          <GoalNotes goal={goal} />
          <RoutinesSection goal={goal} />
          <RoutineHeatmapSection goal={goal} />
          <GoalTaskList goal={goal} />
        </div>
      </div>
    </>
  )
}

// ─── 화면 ──────────────────────────────────────────────────────

/** /goal/[goalId] — 목표 상세. 각 영역을 그 자리에서 바로 추가·수정·삭제할 수 있어요 */
export function GoalDetailView({ goalId, justCreated = false }: { goalId: number; justCreated?: boolean }) {
  const { data: goal, isPending, isError, error, refetch } = useGoalCategory(goalId)
  // 한 번에 하나의 입력창만 열어요 (다른 걸 열면 앞의 것은 닫힘)
  const [editing, setEditing] = useState<string | null>(null)
  const editingCtx = useMemo(
    () => ({ editing, open: (key: string) => setEditing(key), close: () => setEditing(null) }),
    [editing]
  )

  if (isPending) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Spinner className="text-ink-3 size-6" />
      </div>
    )
  }

  if (isError || !goal) {
    const notFound = isApiError(error) && error.httpStatus === 404
    return (
      <Card className="mt-6 p-10 text-center">
        <p className="text-lg font-bold">{notFound ? '목표를 찾을 수 없어요' : '목표를 불러오지 못했어요'}</p>
        {!notFound && <p className="text-ink-3 mt-1 text-sm">{error?.message}</p>}
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/goal" className="text-ink-2 px-3 py-2 text-sm font-semibold">
            목표 목록
          </Link>
          {!notFound && <Button onClick={() => refetch()}>다시 시도</Button>}
        </div>
      </Card>
    )
  }

  return (
    <EditingContext.Provider value={editingCtx}>
      <GoalHeader goal={goal} />

      {/* 기록형은 만들 때 루틴·Task 가 없어서 "TimeTable 에 배치할까요?"를 묻지 않아요 */}
      {justCreated && !isRecordGoal(goal) && <PlaceAfterCreateCard goal={goal} className="mt-6" />}
      {goal.temporary && <RefineWithAiCard goal={goal} className="mt-6" />}

      {isRecordGoal(goal) ? <RecordGoalBody goal={goal} /> : <AchievementGoalBody goal={goal} />}
    </EditingContext.Provider>
  )
}

/**
 * 달성형 목표.
 *  - 위: 진행 요약 → "말로 고치기" → 이 목표를 시작한 이유 (가장 먼저 다시 보게)
 *  - 왼쪽: 매일 보는 "할 것" — 루틴 · 루틴 실천 히트맵 · Task (세부 목표는 각 줄의 라벨)
 *  - 오른쪽: 수치 기록 · Task 실천률 · 접어 둔 "세부 구조"(마일스톤 · 세부 목표)
 */
function AchievementGoalBody({ goal }: { goal: GoalCategory }) {
  return (
    <>
      {/* 임시 목표는 기간·수치가 없어 진행률이 의미 없어요 → 구체화 카드만 보여줘요 */}
      {!goal.temporary && (
        <div className="mt-6">
          <Hero goal={goal} />
        </div>
      )}
      {!goal.temporary && goal.goalCategoryStatus !== 'COMPLETED' && (
        <div className="mt-4">
          <GoalAiEditBar goal={goal} />
        </div>
      )}
      {(goal.motive || goal.aiNote) && (
        <div className="mt-4">
          <GoalNotes goal={goal} />
        </div>
      )}

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-5">
          <RoutinesSection goal={goal} />
          <RoutineHeatmapSection goal={goal} />
          <GoalTaskList goal={goal} />
        </div>

        <div className="space-y-5">
          {/* 목표 지점까지 지금 어디쯤인지 (수치 기록 그래프 · Task 누적) */}
          {!goal.temporary && <ProgressSection goal={goal} />}
          <TaskRateSection goal={goal} />
          <StructurePanel goal={goal} />
          {goal.achievement && (
            <Section title="달성 기록">
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{goal.achievement}</p>
            </Section>
          )}
        </div>
      </div>
    </>
  )
}
