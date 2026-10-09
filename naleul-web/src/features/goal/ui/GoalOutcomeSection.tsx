'use client'

import { useState } from 'react'
import { CalendarMinus, CalendarPlus, Flag, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import {
  useApplyAdjustment,
  useCompleteGoal,
  useDismissAdjustment,
  useGoalProgress,
  useUpdateOutcome,
  type GoalAdjustment,
  type GoalCategory,
  type GoalOutcome,
  type OutcomeResult,
} from '../api'
import { inlineInput } from '../edit/inline'
import { JAVA_DAY_LABEL } from '../format'
import { Section } from './sections'

export const OUTCOME_OPTIONS: { value: OutcomeResult; emoji: string; label: string; hint: string }[] = [
  { value: 'ACHIEVED', emoji: '🎉', label: '달성했어요', hint: '목표한 만큼 해냈어요' },
  { value: 'PARTIAL', emoji: '🙂', label: '일부 달성', hint: '절반 이상은 해냈어요' },
  { value: 'NOT_ACHIEVED', emoji: '😣', label: '못 했어요', hint: '이번엔 어려웠어요' },
]
const outcomeOf = (r: OutcomeResult) => OUTCOME_OPTIONS.find((o) => o.value === r)!

const ACHIEVEMENT_MAX = 500

function todayYmd() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function OutcomePicker({
  value,
  onChange,
  disabled,
}: {
  value: OutcomeResult | null
  onChange: (v: OutcomeResult) => void
  disabled?: boolean
}) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="결과">
      {OUTCOME_OPTIONS.map((o) => {
        const selected = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-2xl border px-2 py-3 text-center transition-colors disabled:opacity-60',
              selected ? 'border-brand bg-brand-soft' : 'border-line-strong hover:border-ink-4'
            )}
          >
            <span className="block text-xl">{o.emoji}</span>
            <span className={cn('mt-1 block text-[13px] font-bold', selected && 'text-brand')}>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── 진행 중: 목표 마무리 ───────────────────────────────────────

/** 진행 중인 달성형 목표를 결과와 함께 끝내요. 고른 결과는 다음 목표 추천의 근거가 돼요 */
export function GoalWrapUpSection({ goal }: { goal: GoalCategory }) {
  const progress = useGoalProgress(goal.goalCategoryId)
  const complete = useCompleteGoal(goal.goalCategoryId)
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<OutcomeResult | null>(null)
  const [achievement, setAchievement] = useState('')

  const today = todayYmd()
  const metricDone = progress.data?.metric?.status === 'ACHIEVED'
  const periodOver = !!goal.goalCategoryEndDate && goal.goalCategoryEndDate < today
  const lead = metricDone
    ? '목표값에 도달했어요! 결과를 남기고 마무리해 볼까요?'
    : periodOver
      ? '기간이 끝났어요. 어땠는지 남기고 마무리해요.'
      : '목표를 끝냈다면 결과를 남겨 주세요. 다음 목표를 짤 때 참고해요.'

  const openModal = () => {
    setResult(metricDone ? 'ACHIEVED' : null)
    setAchievement('')
    setOpen(true)
  }

  const submit = () => {
    if (!result) return
    complete.mutate(
      { goalCategoryEndDate: today, achievement: achievement.trim() || null, result },
      { onSuccess: () => setOpen(false) }
    )
  }

  return (
    <Section title="목표 마무리">
      <p className={cn('text-[14px]', metricDone || periodOver ? 'text-ink font-semibold' : 'text-ink-2')}>{lead}</p>
      <Button
        variant={metricDone || periodOver ? 'primary' : 'secondary'}
        fullWidth
        className="mt-3"
        onClick={openModal}
      >
        <Flag className="size-4" />
        마무리하기
      </Button>

      <Modal
        open={open}
        onClose={() => !complete.isPending && setOpen(false)}
        title="이 목표, 어땠나요?"
        description="오늘 날짜로 마무리하고, 앞으로 예정된 할 일은 정리돼요."
        dismissible={!complete.isPending}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={complete.isPending}>
              취소
            </Button>
            <Button onClick={submit} disabled={!result} loading={complete.isPending}>
              마무리하기
            </Button>
          </>
        }
      >
        <OutcomePicker value={result} onChange={setResult} disabled={complete.isPending} />
        <label className="mt-4 block">
          <span className="text-ink-2 text-[13px] font-semibold">한 줄 소감 (선택)</span>
          <textarea
            value={achievement}
            onChange={(e) => setAchievement(e.target.value.slice(0, ACHIEVEMENT_MAX))}
            rows={3}
            disabled={complete.isPending}
            placeholder="예) 주 3회 운동은 지켰는데 식단은 어려웠어요"
            className={cn(inlineInput, 'bg-surface mt-1.5 h-auto min-h-[80px] resize-y py-2 leading-relaxed')}
          />
        </label>
      </Modal>
    </Section>
  )
}

// ─── 끝난 목표: 결과 ────────────────────────────────────────────

function OutcomeStats({ outcome }: { outcome: GoalOutcome }) {
  const stats = [
    outcome.metricPercent != null && `수치 ${outcome.metricPercent}%`,
    outcome.routineRate != null && `루틴 실천 ${outcome.routineRate}%`,
    outcome.taskRate != null && `할 일 완료 ${outcome.taskRate}%`,
  ].filter(Boolean) as string[]
  if (!stats.length) return null
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {stats.map((s) => (
        <span key={s} className="bg-subtle text-ink-2 rounded-full px-3 py-1 text-[13px] font-medium tabular-nums">
          {s}
        </span>
      ))}
    </div>
  )
}

/**
 * 끝난 목표의 결과.
 * 기간 만료로 자동 판정(AUTO)된 목표는 "이 목표 어땠나요?"로 직접 골라 달라고 해요 — 직접 고른 결과가 더 정확해요.
 */
export function GoalOutcomeSection({ goal }: { goal: GoalCategory }) {
  const progress = useGoalProgress(goal.goalCategoryId)
  const update = useUpdateOutcome(goal.goalCategoryId)
  const [editing, setEditing] = useState(false)
  const outcome = progress.data?.outcome ?? null

  const ask = !outcome || outcome.source === 'AUTO' || editing
  const choose = (r: OutcomeResult) => update.mutate(r, { onSuccess: () => setEditing(false) })

  return (
    <Section
      title="목표 결과"
      aside={
        outcome?.source === 'USER' &&
        !editing && (
          <button type="button" onClick={() => setEditing(true)} className="hover:text-ink font-semibold">
            바꾸기
          </button>
        )
      }
    >
      {outcome && !editing && (
        <p className="text-[17px] font-bold">
          {outcomeOf(outcome.result).emoji} {outcomeOf(outcome.result).label}
          {outcome.source === 'AUTO' && <span className="text-ink-3 ml-2 text-xs font-medium">기록으로 자동 판정</span>}
        </p>
      )}
      {outcome && <OutcomeStats outcome={outcome} />}
      {ask && (
        <div className={cn(outcome && !editing && 'border-line mt-4 border-t pt-4')}>
          <p className="text-ink-2 mb-2.5 text-[14px] font-semibold">
            {editing ? '결과를 다시 골라 주세요' : '이 목표 어땠나요? 직접 골라 주면 다음 목표가 더 잘 맞춰져요'}
          </p>
          <OutcomePicker
            value={editing ? (outcome?.result ?? null) : null}
            onChange={choose}
            disabled={update.isPending}
          />
          {editing && (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-ink-3 hover:text-ink mt-2 text-[13px] font-semibold"
            >
              취소
            </button>
          )}
        </div>
      )}
    </Section>
  )
}

// ─── 진행 중: 주간 점검 제안 ────────────────────────────────────

/** 2주 연속 실천률이 낮으면 하루 줄이기, 높으면 하루 늘리기를 제안해요 */
export function GoalAdjustmentBanner({ goal }: { goal: GoalCategory }) {
  const progress = useGoalProgress(goal.goalCategoryId)
  const apply = useApplyAdjustment(goal.goalCategoryId)
  const dismiss = useDismissAdjustment(goal.goalCategoryId)
  const adj: GoalAdjustment | null | undefined = progress.data?.adjustment
  if (!adj) return null

  const down = adj.direction === 'DOWN'
  const Icon = down ? CalendarMinus : CalendarPlus
  const busy = apply.isPending || dismiss.isPending
  const day = JAVA_DAY_LABEL[adj.day]

  return (
    <div
      className={cn(
        'relative rounded-2xl border px-5 py-4',
        down ? 'border-warning/40 bg-warning-soft' : 'border-brand/30 bg-brand-soft'
      )}
    >
      <button
        type="button"
        aria-label="이번엔 넘기기"
        onClick={() => dismiss.mutate(adj.key)}
        disabled={busy}
        className="text-ink-3 hover:text-ink absolute top-3 right-3 rounded-lg p-1"
      >
        <X className="size-4" />
      </button>
      <p className={cn('flex items-center gap-1.5 pr-6 text-sm font-bold', down ? 'text-[#b45309]' : 'text-brand')}>
        <Icon className="size-4" />
        주간 점검 · {adj.routineName}
      </p>
      <p className="text-ink-2 mt-1 text-[14px]">{adj.message}</p>
      <p className="text-ink-3 mt-1 text-[13px] tabular-nums">
        지난 2주 실천률 {adj.previousWeekRate}% → {adj.lastWeekRate}% · 주 {adj.fromDays}회 → {adj.toDays}회
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => apply.mutate(adj.key)} loading={apply.isPending} disabled={busy}>
          {down ? `${day}요일 빼기` : `${day}요일 더하기`}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => dismiss.mutate(adj.key)} disabled={busy}>
          지금 그대로 할게요
        </Button>
      </div>
    </div>
  )
}
