'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ChevronDown,
  CornerDownLeft,
  MessageSquareText,
  RefreshCw,
  Sparkles,
  UserCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import { isApiError } from '@/lib/client/api'
import { toast } from '@/stores/toastStore'
import { useUserColors } from '@/features/color/api'
import { goalKeys } from '@/features/goal/api'
import { goalCreationApi, goalCreationKeys } from '../../api'
import { PLAN_INTENSITY_DESCRIPTION, PLAN_INTENSITY_LABEL, PLANNING_STYLE_LABEL } from '../../constants'
import { markStyleSelectedByUser, wasStyleSelectedByUser } from '../../planningStyleMemory'
import { goalFlowPath } from '../../routes'
import type {
  DraftResponse,
  GoalPlan,
  PlanFit,
  PlanIntensity,
  PlanIssue,
  PlanningStyle,
  SessionDetail,
} from '../../types'
import { useAiUsage, usageItem, usageKeys } from '@/features/usage/api'
import { UsageLine } from '@/features/usage/ui/UsageLine'
import { FlowShell } from '../SessionGate'
import { textareaClass } from '../formParts'
import { InlineItemEditor, sameTarget, type EditResult, type EditTarget } from './ItemEditModal'
import {
  GoalHeroCard,
  MetricCard,
  MilestoneTimeline,
  OneTimeTasksCard,
  RoutinesCard,
  SubGoalsCard,
} from './PlanSections'
import {
  LIMITS,
  groupIssues,
  isRoutine,
  itemKeyOf,
  normalizePlan,
  validatePlan,
  weeklyRoutineMinutes,
} from './planUtils'

const FEEDBACK_MAX = 200

/** 말로 고치기 예시 */
const QUICK_FIX_EXAMPLES = ['운동은 주 2회로 줄여줘', '루틴을 저녁 시간으로 옮겨줘', '하나만 남기고 더 가볍게']

/** 첫 번째 문제 항목으로 스크롤 */
function scrollToIssue(issues: PlanIssue[]) {
  const first = issues[0]
  if (!first) return
  // 다음 렌더(빨간 테두리 표시) 후에 이동
  requestAnimationFrame(() => {
    const el =
      document.querySelector(`[data-vkey="${itemKeyOf(first.path)}"]`) ??
      document.querySelector(`[data-vkey="${first.path.split(/[.[]/)[0]}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

interface Props {
  session: SessionDetail
  draft: DraftResponse & { plan: GoalPlan }
}

/** G-4 초안 검토 · 수정 · 확정 */
export function DraftReviewView({ session, draft }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const sessionId = session.sessionId
  // 계획 다시 만들기 남은 횟수: 이 대화 한도와 오늘 한도 중 작은 쪽
  const usage = useAiUsage(sessionId)
  const regenLeft = usage.data?.session ?? undefined
  const draftLeft = usageItem(usage.data, 'GOAL_DRAFT')
  const regenRemaining =
    regenLeft?.remaining != null || draftLeft?.remaining != null
      ? Math.min(regenLeft?.remaining ?? Infinity, draftLeft?.remaining ?? Infinity)
      : null
  const noRegen = regenRemaining === 0
  const colors = useUserColors()

  const [plan, setPlan] = useState<GoalPlan>(draft.plan)
  const [colorId, setColorId] = useState<number | null>(null)
  const [serverIssues, setServerIssues] = useState<PlanIssue[] | null>(null)
  const [showClientIssues, setShowClientIssues] = useState(false)
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)

  const [confirming, setConfirming] = useState(false)
  const [regenOpen, setRegenOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [regenerating, setRegenerating] = useState(false)
  const [styleOpen, setStyleOpen] = useState(false)
  const [pendingStyle, setPendingStyle] = useState<PlanningStyle | null>(null)
  const [intensityOpen, setIntensityOpen] = useState(false)
  const [pendingIntensity, setPendingIntensity] = useState<PlanIntensity | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [quickFix, setQuickFix] = useState('')
  // 세부 목표·마일스톤은 기본으로 접어 둬요 (트리 구조를 몰라도 루틴만 보고 고칠 수 있게)
  const [structureOpen, setStructureOpen] = useState(false)

  const dirty = plan !== draft.plan
  const clientIssues = useMemo(() => validatePlan(plan), [plan])
  const shownIssues = useMemo(
    () => [...(serverIssues ?? []), ...(showClientIssues ? clientIssues : [])],
    [serverIssues, showClientIssues, clientIssues]
  )
  const issueMap = useMemo(() => groupIssues(shownIssues), [shownIssues])
  // 세부 구조 안에 고칠 곳이 있거나 그 안의 항목을 편집 중이면 접혀 있지 않게
  const structureHasIssue =
    [...issueMap.keys()].some((k) => k.startsWith('subGoals') || k.startsWith('milestones')) ||
    editTarget?.kind === 'subGoal' ||
    editTarget?.kind === 'milestone'

  const routines = plan.tasks.filter(isRoutine)
  const oneTimes = plan.tasks.length - routines.length
  const busy = confirming || regenerating || cancelling

  // ── 편집 ────────────────────────────────────────────────────
  const update = (next: GoalPlan) => {
    // 마일스톤 날짜·수치, 할 일 마감을 자동으로 맞춰요 → 하나 고쳤다고 다른 곳에 오류가 생기지 않게
    setPlan(normalizePlan(next))
    setServerIssues(null) // 서버 결과는 이전 내용 기준이라 지워요 (index 가 바뀌었을 수 있음)
  }

  const applyEdit = (r: EditResult) => {
    const p = plan
    if (r.kind === 'goal') {
      const metric = p.goal.metric && r.metricValues ? { ...p.goal.metric, ...r.metricValues } : p.goal.metric
      update({
        ...p,
        goal: {
          ...p.goal,
          title: r.title,
          emoji: r.emoji,
          startDate: r.startDate,
          endDate: r.endDate,
          metric,
        },
      })
    } else if (r.kind === 'subGoal') {
      const list = r.index === null ? [...p.subGoals, r.item] : p.subGoals.map((x, i) => (i === r.index ? r.item : x))
      update({ ...p, subGoals: list })
    } else if (r.kind === 'milestone') {
      const list =
        r.index === null ? [...p.milestones, r.item] : p.milestones.map((x, i) => (i === r.index ? r.item : x))
      // 마일스톤은 항상 날짜 순서로
      update({ ...p, milestones: [...list].sort((a, b) => a.dueDate.localeCompare(b.dueDate)) })
    } else {
      const list = r.index === null ? [...p.tasks, r.item] : p.tasks.map((x, i) => (i === r.index ? r.item : x))
      update({ ...p, tasks: list })
    }
    setEditTarget(null)
  }

  /** 지울 수 없는 이유 (최소 개수) */
  const deleteBlockReason = (t: EditTarget | null): string | null => {
    if (!t || t.kind === 'goal') return null
    if (t.kind === 'subGoal' && plan.subGoals.length <= LIMITS.subGoals[0])
      return `세부 목표는 최소 ${LIMITS.subGoals[0]}개가 필요해요.`
    if (t.kind === 'milestone' && plan.milestones.length <= LIMITS.milestones[0])
      return `마일스톤은 최소 ${LIMITS.milestones[0]}개가 필요해요.`
    if (t.kind === 'task' && routines.length + oneTimes <= 1) return '할 일은 최소 1개가 필요해요.'
    if (t.kind === 'task' && t.taskType === 'ROUTINE' && routines.length <= LIMITS.routines[0])
      return `루틴은 최소 ${LIMITS.routines[0]}개가 필요해요.`
    if (t.kind === 'task' && t.taskType === 'ONE_TIME' && oneTimes <= LIMITS.oneTimes[0])
      return `할 일은 최소 ${LIMITS.oneTimes[0]}개가 필요해요.`
    return null
  }

  /** 편집 중인 항목 자리에 들어갈 편집기 (카드들이 각 줄마다 물어봐요) */
  const editor = (t: EditTarget) =>
    editTarget && sameTarget(editTarget, t) ? (
      <InlineItemEditor
        key={JSON.stringify(editTarget)}
        target={editTarget}
        plan={plan}
        onClose={() => setEditTarget(null)}
        onSave={applyEdit}
        onDelete={deleteTarget}
        deleteDisabledReason={deleteBlockReason(editTarget)}
      />
    ) : null

  const deleteTarget = () => {
    const t = editTarget
    if (!t || t.kind === 'goal' || t.index === null) return
    const p = plan
    if (t.kind === 'subGoal') {
      const removed = p.subGoals[t.index]
      const rest = p.subGoals.filter((_, i) => i !== t.index)
      // 지운 세부 목표에 연결된 Task 는 첫 번째 세부 목표로 옮겨요
      const tasks = p.tasks.map((task) =>
        task.subGoalTempId === removed.tempId ? { ...task, subGoalTempId: rest[0]?.tempId ?? null } : task
      )
      update({ ...p, subGoals: rest, tasks })
    } else if (t.kind === 'milestone') {
      const removed = p.milestones[t.index]
      const tasks = p.tasks.map((task) =>
        task.milestoneTempId === removed.tempId ? { ...task, milestoneTempId: null } : task
      )
      update({ ...p, milestones: p.milestones.filter((_, i) => i !== t.index), tasks })
    } else {
      update({ ...p, tasks: p.tasks.filter((_, i) => i !== t.index) })
    }
    setEditTarget(null)
    toast.show('삭제했어요.')
  }

  // ── 다시 생성 / 성향 변경 ──────────────────────────────────
  const regenerate = async (body: {
    feedback?: string
    planningStyle?: PlanningStyle
    intensity?: PlanIntensity
    basePlan?: GoalPlan
  }) => {
    setRegenerating(true)
    try {
      const res = await goalCreationApi.requestDraft(sessionId, body)
      queryClient.removeQueries({ queryKey: goalCreationKeys.session(sessionId) })
      queryClient.invalidateQueries({ queryKey: usageKeys.all })
      router.replace(goalFlowPath.generating(sessionId, res.draftId))
    } catch (error) {
      setRegenerating(false)
      if (isApiError(error) && error.httpStatus === 409) {
        router.replace(goalFlowPath.generating(sessionId))
        return
      }
      toast.error(isApiError(error) ? error.message : '다시 만들지 못했어요.')
    }
  }

  const submitFeedback = () => {
    const text = feedback.trim()
    const style = wasStyleSelectedByUser(sessionId) ? plan.goal.planningStyle : undefined
    regenerate({ ...(text ? { feedback: text } : {}), ...(style ? { planningStyle: style } : {}) })
  }

  /**
   * 말로 고치기 — 화면에서 고친 지금 초안(basePlan)을 기준으로 이 문장에 해당하는 부분만 AI 가 바꿔요.
   * "다시 생성"과 달리 직접 고친 내용이 사라지지 않아요.
   */
  const submitQuickFix = () => {
    const text = quickFix.trim()
    if (!text || busy) return
    const style = wasStyleSelectedByUser(sessionId) ? plan.goal.planningStyle : undefined
    regenerate({
      feedback: text,
      basePlan: plan,
      ...(style ? { planningStyle: style } : {}),
    })
  }

  const changeStyle = () => {
    if (!pendingStyle) return
    markStyleSelectedByUser(sessionId)
    setPendingStyle(null)
    regenerate({ planningStyle: pendingStyle })
  }

  /** 강도 변경 — 서버가 이 사용자 기준 상한을 다시 계산해서 처음부터 다시 만들어요 (강도 선택은 다음 재생성에도 유지돼요) */
  const changeIntensity = () => {
    if (!pendingIntensity) return
    const style = wasStyleSelectedByUser(sessionId) ? plan.goal.planningStyle : undefined
    const next = pendingIntensity
    setPendingIntensity(null)
    regenerate({ intensity: next, ...(style ? { planningStyle: style } : {}) })
  }

  // ── 확정 ────────────────────────────────────────────────────
  const confirm = async () => {
    if (busy) return
    if (clientIssues.length) {
      setShowClientIssues(true)
      setServerIssues(null)
      toast.error('수정이 필요한 항목이 있어요.')
      scrollToIssue(clientIssues)
      return
    }

    setConfirming(true)
    try {
      const { goalId } = await goalCreationApi.confirm(sessionId, {
        draftId: draft.draftId,
        plan,
        planningStyleSelectedByUser: wasStyleSelectedByUser(sessionId),
        ...(colorId !== null ? { colorId } : {}),
      })
      queryClient.removeQueries({ queryKey: goalCreationKeys.all })
      queryClient.invalidateQueries({ queryKey: goalKeys.all }) // 사이드바 · 목표 목록 갱신
      toast.success('목표가 만들어졌어요.')
      // 상세 화면에서 "이어서 TimeTable 에 배치할까요?"를 물어봐요
      router.replace(`/goal/${goalId}?created=1`)
    } catch (error) {
      setConfirming(false)
      if (!isApiError(error)) return toast.error('목표를 만들지 못했어요. 다시 시도해 주세요.')

      if (error.httpStatus === 422 && error.violations.length) {
        setServerIssues(error.violations)
        toast.error(error.message)
        scrollToIssue(error.violations)
        return
      }
      if (error.httpStatus === 409) {
        // 이미 확정됐거나(더블클릭/다른 탭) 더 새로운 초안이 있음 → 서버 상태 다시 확인
        toast.show(error.message)
        const latest = await goalCreationApi.getSession(sessionId).catch(() => null)
        if (latest?.status === 'CONFIRMED') return router.replace('/goal')
        queryClient.invalidateQueries({ queryKey: goalCreationKeys.session(sessionId) })
        return
      }
      // 403(무료 플랜 목표 개수 초과) / 기타
      toast.error(error.message)
    }
  }

  const cancelSession = async () => {
    setCancelling(true)
    try {
      await goalCreationApi.cancel(sessionId)
      queryClient.removeQueries({ queryKey: goalCreationKeys.all })
      toast.show('목표 만들기를 그만뒀어요.')
      router.replace('/goal')
    } catch (error) {
      setCancelling(false)
      toast.error(isApiError(error) ? error.message : '취소하지 못했어요.')
    }
  }

  const summary = session.summary
  const summaryChips = [
    summary?.deadlineText,
    summary?.metricText,
    summary?.preferenceText,
    session.mustDoItems?.length ? `꼭 할 일: ${session.mustDoItems.join(' · ')}` : null,
  ].filter(Boolean)

  const currentIntensity: PlanIntensity = plan.fit?.intensity ?? 'STEADY'
  const chipClass =
    'border-line-strong text-ink-2 hover:border-ink-4 inline-flex h-6 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold'
  const styleChip = (
    <>
      <button type="button" onClick={() => setStyleOpen(true)} className={chipClass}>
        {PLANNING_STYLE_LABEL[plan.goal.planningStyle]}
        <ChevronDown className="size-3" />
      </button>
      {plan.fit && (
        <button type="button" onClick={() => setIntensityOpen(true)} className={chipClass}>
          {PLAN_INTENSITY_LABEL[currentIntensity]}
          <ChevronDown className="size-3" />
        </button>
      )}
    </>
  )

  return (
    <FlowShell wide>
      <div className="bg-canvas flex-1 overflow-y-auto">
        <main className="mx-auto w-full max-w-[1280px] px-4 pt-6 pb-10 sm:px-6 lg:px-8">
          {/* 머리말 */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-[28px]">
                <Sparkles className="size-6" />
                AI 목표 설계
              </h1>
              <p className="text-ink-3 mt-1 text-sm">
                AI가 만든 초안이에요. 항목을 누르면 그 자리에서 바로 고칠 수 있어요 (Enter 저장 · Esc 취소).
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setCancelOpen(true)} disabled={busy}>
              그만 만들기
            </Button>
          </div>

          {/* 대화에서 정리한 조건 */}
          <div className="border-line bg-surface mt-5 flex flex-wrap items-center gap-3 rounded-[20px] border px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="text-ink-3 text-xs">이루고 싶은 목표</p>
              <p className="truncate text-[17px] font-bold">{summary?.goalStatement ?? plan.goal.title}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {summaryChips.map((chip) => (
                <span key={chip} className="bg-subtle text-ink-2 rounded-full px-3 py-1.5 text-[13px] font-medium">
                  {chip}
                </span>
              ))}
              <Link
                href={goalFlowPath.review(sessionId)}
                className="text-ink-2 hover:text-ink px-2 text-[13px] font-semibold underline-offset-2 hover:underline"
              >
                조건 수정
              </Link>
            </div>
          </div>

          {/* 이 계획이 나에게 어떻게 맞춰졌는지 */}
          {plan.fit && (
            <PlanFitCard
              fit={plan.fit}
              weeklyMinutes={weeklyRoutineMinutes(plan.tasks)}
              onChangeIntensity={() => setIntensityOpen(true)}
            />
          )}

          {/* SOFT 경고 */}
          {plan.warnings.length > 0 && (
            <div className="border-warning/40 bg-warning-soft mt-4 rounded-2xl border px-5 py-4">
              <p className="flex items-center gap-1.5 text-sm font-bold text-[#b45309]">
                <AlertTriangle className="size-4" />
                확인해 보면 좋은 점
              </p>
              <ul className="mt-1.5 space-y-0.5 text-[13px] text-[#92400e]">
                {plan.warnings.map((w, i) => (
                  <li key={`${w.ruleId}-${i}`}>· {w.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 검증 실패 요약 */}
          {shownIssues.length > 0 && (
            <div role="alert" className="border-danger/30 bg-danger-soft mt-4 rounded-2xl border px-5 py-4">
              <p className="text-danger text-sm font-bold">수정이 필요한 항목이 {issueMap.size}곳 있어요</p>
              <button
                type="button"
                onClick={() => scrollToIssue(shownIssues)}
                className="text-danger mt-1 text-[13px] font-semibold underline underline-offset-2"
              >
                첫 번째 항목으로 이동
              </button>
            </div>
          )}

          {/* 말로 고치기: 트리를 몰라도 한 문장으로 */}
          <div className="border-line bg-surface mt-4 rounded-[20px] border px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <MessageSquareText className="text-brand size-5 shrink-0" />
              <input
                value={quickFix}
                onChange={(e) => setQuickFix(e.target.value.slice(0, FEEDBACK_MAX))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    submitQuickFix()
                  }
                }}
                disabled={busy}
                placeholder="바꾸고 싶은 걸 말로 적어 보세요. 예) 운동은 주 2회로 줄여줘"
                aria-label="말로 고치기"
                className="placeholder:text-ink-4 h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none"
              />
              <Button
                size="sm"
                variant="brand"
                onClick={submitQuickFix}
                loading={regenerating}
                disabled={!quickFix.trim() || busy}
              >
                <CornerDownLeft className="size-3.5" />
                고치기
              </Button>
            </div>
            {!quickFix && (
              <div className="mt-1.5 flex flex-wrap gap-1.5 pl-7">
                {QUICK_FIX_EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setQuickFix(ex)}
                    className="border-line text-ink-3 hover:border-line-strong hover:text-ink-2 h-6 rounded-full border px-2 text-[12px]"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 상단: 목표 + 수치 */}
          <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
            <GoalHeroCard
              plan={plan}
              issues={issueMap}
              onEdit={setEditTarget}
              editor={editor}
              styleChip={styleChip}
              colors={colors.data}
              colorId={colorId}
              onColor={setColorId}
              showMilestones={false}
            />
            <MetricCard plan={plan} onEditGoal={() => setEditTarget({ kind: 'goal' })} />
          </div>

          {/* 가운데: 실제로 할 일 — 루틴이 계획의 중심, 일회성 Task 는 꼭 필요한 것만 */}
          <div className="mt-5 grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <RoutinesCard plan={plan} issues={issueMap} onEdit={setEditTarget} editor={editor} />
            <OneTimeTasksCard plan={plan} issues={issueMap} onEdit={setEditTarget} editor={editor} />
          </div>

          {/* 아래: 세부 구조 (접힘) — 세부 목표 · 마일스톤. 날짜·수치는 자동으로 맞춰져요 */}
          <section className="border-line bg-surface mt-5 rounded-[20px] border">
            <button
              type="button"
              onClick={() => setStructureOpen((v) => !v)}
              aria-expanded={structureOpen || structureHasIssue}
              className="flex w-full items-center gap-3 px-5 py-4 text-left sm:px-7"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold">세부 구조</span>
                <span className="text-ink-3 block text-[13px]">
                  세부 목표 {plan.subGoals.length}개 · 마일스톤 {plan.milestones.length}단계 — 날짜
                  {plan.goal.metric ? '·수치' : ''}는 자동으로 맞춰져요. 꼭 바꿀 때만 열어 보세요.
                </span>
              </span>
              <ChevronDown
                className={cn(
                  'text-ink-3 size-5 transition-transform',
                  (structureOpen || structureHasIssue) && 'rotate-180'
                )}
              />
            </button>
            {(structureOpen || structureHasIssue) && (
              <div className="border-line grid grid-cols-[minmax(0,1fr)] gap-5 border-t px-5 pt-2 pb-6 sm:px-7 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <MilestoneTimeline plan={plan} issues={issueMap} onEdit={setEditTarget} editor={editor} />
                <div className="pt-5">
                  <SubGoalsCard plan={plan} issues={issueMap} onEdit={setEditTarget} editor={editor} />
                </div>
              </div>
            )}
          </section>
        </main>
      </div>

      {/* 하단 고정 바 */}
      <div className="bg-canvas px-4 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
        <div className="bg-ink mx-auto flex max-w-[1280px] flex-col gap-3 rounded-[20px] px-5 py-4 text-white sm:flex-row sm:items-center sm:px-6">
          <div className="flex-1">
            <p className="text-[14px] text-white/85">
              이 목표로 시작하면 <b className="text-[#8EA2FF]">Task {oneTimes}개</b>와{' '}
              <b className="text-[#8EA2FF]">루틴 {routines.length}개</b>가 내일부터 TimeBlock에 자동 배치돼요.
            </p>
            {/* 다시 생성은 한 대화 최대 횟수 + 하루 횟수가 있어요 — 누르기 전에 남은 횟수를 보여줘요 */}
            <UsageLine tone="onDark" className="mt-1" items={[regenLeft, draftLeft]} />
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-white/10 hover:bg-white/20 sm:flex-none"
              onClick={() => setRegenOpen(true)}
              disabled={busy || noRegen}
              title={noRegen ? '오늘(또는 이 목표에서) 계획을 더 만들 수 없어요. 초안을 직접 고쳐 주세요.' : undefined}
            >
              <RefreshCw className="size-4" />
              다시 생성
              {regenRemaining != null && <span className="text-white/60">({regenRemaining}회 남음)</span>}
            </Button>
            <Button
              className="text-ink flex-1 bg-white hover:bg-white/90 sm:flex-none"
              onClick={confirm}
              loading={confirming}
              disabled={busy && !confirming}
            >
              이 목표로 시작하기
            </Button>
          </div>
        </div>
      </div>

      {/* 다시 생성 (피드백) */}
      <Modal
        open={regenOpen}
        onClose={() => setRegenOpen(false)}
        title="계획을 다시 만들까요?"
        description={
          dirty
            ? '직접 수정한 내용은 사라지고 새 초안이 만들어져요.'
            : '바꾸고 싶은 점을 알려주면 반영해서 다시 만들어요.'
        }
        dismissible={!regenerating}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRegenOpen(false)} disabled={regenerating}>
              취소
            </Button>
            <Button onClick={submitFeedback} loading={regenerating}>
              다시 생성
            </Button>
          </>
        }
      >
        <textarea
          autoFocus
          rows={4}
          maxLength={FEEDBACK_MAX}
          className={textareaClass}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="예) 운동을 조금 더 가볍게 해주세요 (선택)"
        />
        <p className="text-ink-3 mt-1 text-right text-xs tabular-nums">
          {feedback.length}/{FEEDBACK_MAX}
        </p>
      </Modal>

      {/* 실행 성향 변경 */}
      <Modal open={styleOpen} onClose={() => setStyleOpen(false)} title="실행 성향" size="sm">
        <div className="space-y-2 pb-2">
          {(['PLANNER', 'SPONTANEOUS'] as const).map((value) => {
            const current = plan.goal.planningStyle === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setStyleOpen(false)
                  if (!current) setPendingStyle(value)
                }}
                className={cn(
                  'w-full rounded-2xl border px-4 py-3.5 text-left text-[15px] font-semibold',
                  current ? 'border-brand bg-brand-soft text-brand' : 'border-line-strong hover:border-ink-4'
                )}
              >
                {PLANNING_STYLE_LABEL[value]}
                {current && <span className="ml-2 text-xs font-medium">현재</span>}
              </button>
            )
          })}
        </div>
      </Modal>
      {/* 계획 강도 변경 */}
      <Modal open={intensityOpen} onClose={() => setIntensityOpen(false)} title="계획 강도" size="sm">
        <div className="space-y-2 pb-2">
          {(['STEADY', 'CHALLENGE'] as const).map((value) => {
            const current = currentIntensity === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setIntensityOpen(false)
                  if (!current) setPendingIntensity(value)
                }}
                className={cn(
                  'w-full rounded-2xl border px-4 py-3.5 text-left',
                  current ? 'border-brand bg-brand-soft' : 'border-line-strong hover:border-ink-4'
                )}
              >
                <span className={cn('block text-[15px] font-semibold', current && 'text-brand')}>
                  {PLAN_INTENSITY_LABEL[value]}
                  {current && <span className="ml-2 text-xs font-medium">현재</span>}
                </span>
                <span className="text-ink-3 mt-0.5 block text-[13px]">{PLAN_INTENSITY_DESCRIPTION[value]}</span>
              </button>
            )
          })}
        </div>
      </Modal>
      <ConfirmDialog
        open={!!pendingIntensity}
        title={`${pendingIntensity ? PLAN_INTENSITY_LABEL[pendingIntensity] : ''}으로 바꿀까요?`}
        description="루틴 양이 달라져서 계획을 처음부터 다시 만들어요. 직접 고친 내용은 사라져요."
        confirmLabel="바꾸고 다시 만들기"
        loading={regenerating}
        onConfirm={changeIntensity}
        onCancel={() => setPendingIntensity(null)}
      />
      <ConfirmDialog
        open={!!pendingStyle}
        title="성향을 바꿀까요?"
        description="성향에 맞게 Task 배치가 달라져서, 계획을 처음부터 다시 만들어요."
        confirmLabel="바꾸고 다시 만들기"
        loading={regenerating}
        onConfirm={changeStyle}
        onCancel={() => setPendingStyle(null)}
      />

      <ConfirmDialog
        open={cancelOpen}
        tone="danger"
        title="목표 만들기를 그만둘까요?"
        description="지금까지 나눈 대화와 초안이 모두 사라져요."
        confirmLabel="그만 만들기"
        cancelLabel="계속 만들기"
        loading={cancelling}
        onConfirm={cancelSession}
        onCancel={() => setCancelOpen(false)}
      />
    </FlowShell>
  )
}

function hoursText(minutes: number) {
  if (minutes < 60) return `${minutes}분`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}시간 ${m}분` : `${h}시간`
}

/** "나에게 맞춘 점" — 서버가 실제 계획과 대조해 확인한 근거만 보여줘요 */
function PlanFitCard({
  fit,
  weeklyMinutes,
  onChangeIntensity,
}: {
  fit: PlanFit
  /** 직접 고친 내용까지 반영한 지금 계획의 루틴 주간 합계 */
  weeklyMinutes: number
  onChangeIntensity: () => void
}) {
  const over = weeklyMinutes > fit.weeklyCapMinutes
  return (
    <div className="border-line bg-surface mt-4 rounded-2xl border px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-bold">
          <UserCheck className="text-brand size-4" />
          나에게 맞춘 점
        </p>
        <button
          type="button"
          onClick={onChangeIntensity}
          className="text-ink-2 hover:text-ink text-[13px] font-semibold underline-offset-2 hover:underline"
        >
          {PLAN_INTENSITY_LABEL[fit.intensity]} · 바꾸기
        </button>
      </div>
      <p className="text-ink-2 mt-1.5 text-[13px]">
        루틴은 일주일에{' '}
        <b className={cn('tabular-nums', over ? 'text-[#b45309]' : 'text-ink')}>{hoursText(weeklyMinutes)}</b>
        <span className="text-ink-3"> · 내 기준 {hoursText(fit.weeklyCapMinutes)} 이내 추천</span>
      </p>
      {over && (
        <p className="mt-1 text-[13px] text-[#b45309]">
          지금 실천량보다 많아요. 처음엔 조금 줄여서 시작하면 끝까지 가기 쉬워요.
        </p>
      )}
      {fit.notes.length > 0 && (
        <ul className="text-ink-2 mt-1.5 space-y-0.5 text-[13px]">
          {fit.notes.map((note) => (
            <li key={note}>· {note}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
