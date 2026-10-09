'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { BarChart3, NotebookPen } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { isApiError } from '@/lib/client/api'
import { cn } from '@/lib/cn'
import { RecordQuickLog } from '@/features/record/ui/RecordQuickLog'
import { RecordJournal } from '@/features/record/ui/RecordJournal'
import { RecordPatternSection } from '@/features/record/ui/pattern/RecordPatternSection'
import { isRecordGoal, useGoalCategory, type GoalCategory } from '../api'
import { EditingContext } from '../edit/inline'
import { dDayLabel, periodProgress } from '../format'
import { GoalAiEditBar } from './GoalAiEditBar'
import { GoalHeader, GoalNotes } from './GoalHeader'
import { GoalAdjustmentBanner, GoalOutcomeSection, GoalWrapUpSection } from './GoalOutcomeSection'
import { GoalTaskList } from './GoalTaskList'
import { PlaceAfterCreateCard } from './PlaceAfterCreateCard'
import { DailyCheckInCard } from './progress/DailyCheckInCard'
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

type RecordTab = 'journal' | 'stats'

const RECORD_TABS: { value: RecordTab; label: string; icon: typeof NotebookPen }[] = [
  { value: 'journal', label: '업무 일지', icon: NotebookPen },
  { value: 'stats', label: '통계', icon: BarChart3 },
]

/**
 * 업무형(기록형) 목표 — 탭 두 개.
 *  - 업무 일지: 오늘 한 일 한 줄 기록 + 업무 일지 | (선택) 메모 · 반복 루틴 · Task
 *  - 통계: 이 목표에 대한 나의 패턴 (완료한 Task 기준 그래프, 넓게)
 * 고른 탭은 주소(?tab=stats)에 남겨서 새로고침·공유해도 그대로예요.
 */
function RecordGoalBody({ goal }: { goal: GoalCategory }) {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const tab: RecordTab = params.get('tab') === 'stats' ? 'stats' : 'journal'

  const setTab = (t: RecordTab) => {
    const next = new URLSearchParams(params)
    if (t === 'journal') next.delete('tab')
    else next.set('tab', t)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <>
      <div className="bg-surface border-line mt-6 inline-flex rounded-xl border p-1" role="tablist" aria-label="보기">
        {RECORD_TABS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`record-tab-${value}`}
            aria-selected={tab === value}
            aria-controls={`record-panel-${value}`}
            onClick={() => setTab(value)}
            className={cn(
              'flex h-9 items-center gap-1.5 rounded-lg px-4 text-[14px] font-semibold transition-colors',
              tab === value ? 'bg-ink text-white' : 'text-ink-2 hover:text-ink'
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'journal' ? (
        <div
          id="record-panel-journal"
          role="tabpanel"
          aria-labelledby="record-tab-journal"
          className="mt-5 grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px]"
        >
          <div className="space-y-5">
            <RecordQuickLog goal={goal} />
            <RecordJournal goalId={goal.goalCategoryId} goalName={goal.goalCategoryName} />
          </div>
          <div className="space-y-5">
            <GoalNotes goal={goal} />
            <RoutinesSection goal={goal} />
            <RoutineHeatmapSection goal={goal} />
            <GoalTaskList goal={goal} />
          </div>
        </div>
      ) : (
        <section id="record-panel-stats" role="tabpanel" aria-labelledby="record-tab-stats" className="mt-5">
          <h2 className="sr-only">이 목표에 대한 나의 패턴</h2>
          <RecordPatternSection goalId={goal.goalCategoryId} />
        </section>
      )}
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
 *  - 위: 진행 요약 → 오늘 기록(수치 + 회고) → "말로 고치기" → 이 목표를 시작한 이유
 *  - 왼쪽: 매일 보는 "할 것" — 루틴 · 루틴 실천 히트맵 · Task (세부 목표는 각 줄의 라벨)
 *  - 오른쪽: 수치 기록 · Task 실천률 · 접어 둔 "세부 구조"(마일스톤 · 세부 목표)
 */
function AchievementGoalBody({ goal }: { goal: GoalCategory }) {
  const completed = goal.goalCategoryStatus === 'COMPLETED'
  const ongoing = !goal.temporary && goal.goalCategoryStatus === 'IN_PROGRESS'
  return (
    <>
      {/* 임시 목표는 기간·수치가 없어 진행률이 의미 없어요 → 구체화 카드만 보여줘요 */}
      {!goal.temporary && (
        <div className="mt-6">
          <Hero goal={goal} />
        </div>
      )}
      {/* 주간 점검: 2주 연속 너무 힘들거나 너무 쉬우면 루틴 하루 빼기/더하기 제안 */}
      {ongoing && (
        <div className="mt-4 empty:hidden">
          <GoalAdjustmentBanner goal={goal} />
        </div>
      )}
      {/* 사용자가 매일 채우는 칸 — 진행 요약 바로 아래에 크게 (수치 · 오늘 어땠는지 · 무엇을 했는지) */}
      {goal.goalCategoryStatus !== 'COMPLETED' && (
        <div className="mt-4">
          <DailyCheckInCard goal={goal} />
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
          {completed && !goal.temporary && <GoalOutcomeSection goal={goal} />}
          {/* 목표 지점까지 지금 어디쯤인지 (수치 기록 그래프 · Task 누적) */}
          {!goal.temporary && <ProgressSection goal={goal} />}
          <TaskRateSection goal={goal} />
          <StructurePanel goal={goal} />
          {ongoing && <GoalWrapUpSection goal={goal} />}
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
