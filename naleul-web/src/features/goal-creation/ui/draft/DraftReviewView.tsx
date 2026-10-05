'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ChevronDown, RefreshCw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import { isApiError } from '@/lib/client/api'
import { toast } from '@/stores/toastStore'
import { useUserColors } from '@/features/color/api'
import { goalKeys } from '@/features/goal/api'
import { goalCreationApi, goalCreationKeys } from '../../api'
import { PLANNING_STYLE_LABEL } from '../../constants'
import { markStyleSelectedByUser, wasStyleSelectedByUser } from '../../planningStyleMemory'
import { goalFlowPath } from '../../routes'
import type { DraftResponse, GoalPlan, PlanIssue, PlanningStyle, SessionDetail } from '../../types'
import { FlowShell } from '../SessionGate'
import { textareaClass } from '../formParts'
import { ItemEditModal, type EditResult, type EditTarget } from './ItemEditModal'
import { GoalHeroCard, MetricCard, OneTimeTasksCard, RoutinesCard, SubGoalsCard } from './PlanSections'
import { LIMITS, groupIssues, isRoutine, itemKeyOf, validatePlan } from './planUtils'

const FEEDBACK_MAX = 200

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
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const dirty = plan !== draft.plan
  const clientIssues = useMemo(() => validatePlan(plan), [plan])
  const shownIssues = useMemo(
    () => [...(serverIssues ?? []), ...(showClientIssues ? clientIssues : [])],
    [serverIssues, showClientIssues, clientIssues]
  )
  const issueMap = useMemo(() => groupIssues(shownIssues), [shownIssues])

  const routines = plan.tasks.filter(isRoutine)
  const oneTimes = plan.tasks.length - routines.length
  const busy = confirming || regenerating || cancelling

  // ── 편집 ────────────────────────────────────────────────────
  const update = (next: GoalPlan) => {
    setPlan(next)
    setServerIssues(null) // 서버 결과는 이전 내용 기준이라 지워요 (index 가 바뀌었을 수 있음)
  }

  const applyEdit = (r: EditResult) => {
    const p = plan
    if (r.kind === 'goal') {
      update({ ...p, goal: { ...p.goal, title: r.title, emoji: r.emoji } })
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
    if (t.kind === 'task' && t.taskType === 'ROUTINE' && routines.length <= LIMITS.routines[0])
      return `루틴은 최소 ${LIMITS.routines[0]}개가 필요해요.`
    if (t.kind === 'task' && t.taskType === 'ONE_TIME' && oneTimes <= LIMITS.oneTimes[0])
      return `할 일은 최소 ${LIMITS.oneTimes[0]}개가 필요해요.`
    return null
  }

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
  const regenerate = async (body: { feedback?: string; planningStyle?: PlanningStyle }) => {
    setRegenerating(true)
    try {
      const res = await goalCreationApi.requestDraft(sessionId, body)
      queryClient.removeQueries({ queryKey: goalCreationKeys.session(sessionId) })
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

  const changeStyle = () => {
    if (!pendingStyle) return
    markStyleSelectedByUser(sessionId)
    setPendingStyle(null)
    regenerate({ planningStyle: pendingStyle })
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
      toast.success('목표가 만들어졌어요. Task가 TimeBlock에 배치돼요.')
      router.replace(`/goal/${goalId}`)
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
  const summaryChips = [summary?.deadlineText, summary?.metricText, summary?.preferenceText].filter(Boolean)

  const styleChip = (
    <button
      type="button"
      onClick={() => setStyleOpen(true)}
      className="border-line-strong text-ink-2 hover:border-ink-4 inline-flex h-6 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold"
    >
      {PLANNING_STYLE_LABEL[plan.goal.planningStyle]}
      <ChevronDown className="size-3" />
    </button>
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
              <p className="text-ink-3 mt-1 text-sm">AI가 만든 초안이에요. 항목을 눌러 직접 수정할 수 있어요.</p>
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

          {/* 상단: 목표 + 수치 */}
          <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
            <GoalHeroCard
              plan={plan}
              issues={issueMap}
              onEdit={setEditTarget}
              styleChip={styleChip}
              colors={colors.data}
              colorId={colorId}
              onColor={setColorId}
            />
            <MetricCard plan={plan} />
          </div>

          {/* 하단: 세부 목표 · Task · 루틴 */}
          <div className="mt-5 grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-3">
            <SubGoalsCard plan={plan} issues={issueMap} onEdit={setEditTarget} />
            <OneTimeTasksCard plan={plan} issues={issueMap} onEdit={setEditTarget} />
            <RoutinesCard plan={plan} issues={issueMap} onEdit={setEditTarget} />
          </div>
        </main>
      </div>

      {/* 하단 고정 바 */}
      <div className="bg-canvas px-4 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
        <div className="bg-ink mx-auto flex max-w-[1280px] flex-col gap-3 rounded-[20px] px-5 py-4 text-white sm:flex-row sm:items-center sm:px-6">
          <p className="flex-1 text-[14px] text-white/85">
            이 목표로 시작하면 <b className="text-[#8EA2FF]">Task {oneTimes}개</b>와{' '}
            <b className="text-[#8EA2FF]">루틴 {routines.length}개</b>가 내일부터 TimeBlock에 자동 배치돼요.
          </p>
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-white/10 hover:bg-white/20 sm:flex-none"
              onClick={() => setRegenOpen(true)}
              disabled={busy}
            >
              <RefreshCw className="size-4" />
              다시 생성
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

      {/* 항목 수정 */}
      <ItemEditModal
        target={editTarget}
        plan={plan}
        onClose={() => setEditTarget(null)}
        onSave={applyEdit}
        onDelete={deleteTarget}
        deleteDisabledReason={deleteBlockReason(editTarget)}
      />

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
