'use client'

import Link from 'next/link'
import { Bell, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Chip'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { isApiError } from '@/lib/client/api'
import { useGoalCategory, type GoalCategory, type MilestoneInfo, type RoutineSummary } from '../api'
import {
  JAVA_DAYS,
  JAVA_DAY_LABEL,
  dDayLabel,
  formatDot,
  goalColor,
  hhmm,
  periodProgress,
  statusLabel,
} from '../format'
import { GoalTaskList } from './GoalTaskList'

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

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[17px] font-bold">{title}</h2>
        {aside && <span className="text-ink-3 text-[13px]">{aside}</span>}
      </div>
      {children}
    </Card>
  )
}

function DayChips({ days }: { days: RoutineSummary['repeatDays'] }) {
  return (
    <span className="flex gap-1">
      {JAVA_DAYS.map((d) => (
        <span
          key={d}
          className={cn(
            'grid size-6 place-items-center rounded-md text-[11px] font-semibold',
            days.includes(d) ? 'bg-brand text-white' : 'bg-subtle text-ink-4'
          )}
        >
          {JAVA_DAY_LABEL[d]}
        </span>
      ))}
    </span>
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

function SubGoals({ goal }: { goal: GoalCategory }) {
  const subs = goal.generalCategories
  return (
    <Section title="세부 목표" aside={`${subs.length}개`}>
      {subs.length === 0 ? (
        <p className="text-ink-3 text-sm">세부 목표가 없어요.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {subs.map((sg) => (
            <div key={sg.generalCategoryId} className="bg-canvas rounded-2xl p-4">
              <span
                className="block h-1 w-8 rounded-full"
                style={{ backgroundColor: goalColor(sg.colorCode ?? goal.colorCode) }}
              />
              <p className="mt-3 text-[15px] font-bold">{sg.generalCategoryName}</p>
              <p className="text-ink-3 mt-1 text-[13px]">루틴 {sg.routines.length}개</p>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

function Routines({ goal }: { goal: GoalCategory }) {
  const rows = goal.generalCategories.flatMap((sg) =>
    sg.routines.map((r) => ({ routine: r, subGoal: sg.generalCategoryName }))
  )
  return (
    <Section title="루틴" aside={`${rows.length}개`}>
      {rows.length === 0 ? (
        <p className="text-ink-3 text-sm">등록된 루틴이 없어요.</p>
      ) : (
        <ul className="divide-line divide-y">
          {rows.map(({ routine, subGoal }) => {
            const start = hhmm(routine.repeatStartTime)
            const end = hhmm(routine.repeatEndTime)
            return (
              <li key={routine.routineId} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[15px] font-semibold">
                    {routine.routineName}
                    {routine.notificationEnabled && <Bell className="text-ink-3 size-3.5" aria-label="알림 켜짐" />}
                  </p>
                  <p className="text-ink-3 mt-0.5 text-[13px]">
                    {subGoal}
                    {start && ` · ${start}${end ? `~${end}` : ''}`}
                  </p>
                </div>
                <DayChips days={routine.repeatDays} />
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

function Milestones({ milestones, unit }: { milestones: MilestoneInfo[]; unit: string }) {
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const achieved = milestones.filter((m) => m.status === 'ACHIEVED').length
  // 지금 향하고 있는 마일스톤: 아직 달성 안 했고 기한이 남은 것 중 가장 가까운 것
  const currentId = milestones.find((m) => m.status !== 'ACHIEVED' && m.dueDate >= today)?.milestoneId
  return (
    <Section title="마일스톤" aside={`${achieved} / ${milestones.length} 달성`}>
      <ol className="relative space-y-5 pl-7">
        <span className="bg-line-strong absolute top-2 bottom-2 left-[9px] w-0.5" aria-hidden />
        {milestones.map((m) => {
          const done = m.status === 'ACHIEVED'
          const current = m.milestoneId === currentId
          return (
            <li key={m.milestoneId} className="relative">
              <span
                className={cn(
                  'absolute top-0.5 -left-7 size-5 rounded-full border-[3px]',
                  done
                    ? 'border-success bg-success'
                    : current
                      ? 'border-brand bg-surface'
                      : 'border-line-strong bg-surface'
                )}
              />
              <p className="text-ink-3 text-xs">~{formatDot(m.dueDate)}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[15px] font-bold">
                {m.title}
                {m.targetValue != null && (
                  <Badge tone={done ? 'success' : 'brand'} className="h-5 px-1.5 text-[11px]">
                    {m.targetValue}
                    {unit}
                  </Badge>
                )}
              </p>
              {m.description && <p className="text-ink-3 mt-0.5 text-[13px]">{m.description}</p>}
            </li>
          )
        })}
      </ol>
    </Section>
  )
}

// ─── 화면 ──────────────────────────────────────────────────────

/** /goal/[goalId] — 목표 상세 */
export function GoalDetailView({ goalId }: { goalId: number }) {
  const { data: goal, isPending, isError, error, refetch } = useGoalCategory(goalId)

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

  const period = periodProgress(goal.goalCategoryStartDate, goal.goalCategoryEndDate)
  const milestones = [...(goal.milestones ?? [])].sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  return (
    <>
      {/* 머리말 */}
      <div>
        <p className="text-ink-3 text-[13px]">
          <Link href="/goal" className="hover:text-ink">
            목표
          </Link>{' '}
          › {goal.goalCategoryName}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <span className="size-3 rounded-full" style={{ backgroundColor: goalColor(goal.colorCode) }} />
          <h1 className="text-2xl font-bold tracking-tight sm:text-[30px]">
            {goal.emoji ? `${goal.emoji} ` : ''}
            {goal.goalCategoryName}
          </h1>
          <Badge tone={goal.goalCategoryStatus === 'COMPLETED' ? 'success' : 'neutral'}>
            {statusLabel(goal.goalCategoryStatus)}
          </Badge>
        </div>
        {goal.goalCategoryStartDate && (
          <p className="text-ink-3 mt-1.5 text-sm">
            {formatDot(goal.goalCategoryStartDate)} – {formatDot(goal.goalCategoryEndDate)}
            {period && ` · ${period.weeks}주`}
          </p>
        )}
      </div>

      <div className="mt-6">
        <Hero goal={goal} />
      </div>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-5">
          {(goal.motive || goal.aiNote) && (
            <Card className="space-y-3 p-5 sm:p-6">
              {goal.motive && (
                <div>
                  <p className="text-ink-3 text-[13px] font-medium">이 목표를 시작한 이유</p>
                  <p className="mt-1 text-[15px] leading-relaxed">{goal.motive}</p>
                </div>
              )}
              {goal.aiNote && (
                <p className="bg-canvas flex gap-2 rounded-2xl px-4 py-3 text-[14px] leading-relaxed">
                  <Sparkles className="text-brand mt-0.5 size-4 shrink-0" />
                  {goal.aiNote}
                </p>
              )}
            </Card>
          )}
          <SubGoals goal={goal} />
          <Routines goal={goal} />
          <GoalTaskList goalId={goal.goalCategoryId} />
        </div>

        <div className="space-y-5">
          {milestones.length > 0 && <Milestones milestones={milestones} unit={goal.metricUnit ?? ''} />}
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
