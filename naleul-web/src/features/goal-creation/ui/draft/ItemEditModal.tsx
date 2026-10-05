'use client'

import { useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Modal } from '@/components/ui/Modal'
import { DAY_LABEL, DAYS } from '../../constants'
import type { DayOfWeek, GoalPlan, PlanMilestone, PlanSubGoal, PlanTask } from '../../types'
import { Field, inputClass, textareaClass, toNumber } from '../formParts'
import { LIMITS, formatMd, newTempId } from './planUtils'

/** 지금 편집 중인 대상. index 가 null 이면 새로 추가 */
export type EditTarget =
  | { kind: 'goal' }
  | { kind: 'subGoal'; index: number | null }
  | { kind: 'milestone'; index: number | null }
  | { kind: 'task'; index: number | null; taskType: PlanTask['type'] }

export type EditResult =
  | { kind: 'goal'; title: string; emoji: string | null }
  | { kind: 'subGoal'; index: number | null; item: PlanSubGoal }
  | { kind: 'milestone'; index: number | null; item: PlanMilestone }
  | { kind: 'task'; index: number | null; item: PlanTask }

interface FormProps<T extends EditTarget> {
  target: T
  plan: GoalPlan
  formId: string
  onDone: (result: EditResult) => void
  onError: (message: string) => void
}

const submitter = (fn: () => void) => (e: FormEvent) => {
  e.preventDefault()
  fn()
}

function EmojiTitle({
  emoji,
  title,
  onEmoji,
  onTitle,
  placeholder,
}: {
  emoji: string
  title: string
  onEmoji: (v: string) => void
  onTitle: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="grid grid-cols-[64px_1fr] gap-3">
      <Field label="이모지">
        <input
          className={`${inputClass} text-center`}
          value={emoji}
          maxLength={4}
          onChange={(e) => onEmoji(e.target.value)}
          placeholder="🙂"
        />
      </Field>
      <Field label="제목">
        <input
          autoFocus
          className={inputClass}
          value={title}
          maxLength={LIMITS.title}
          onChange={(e) => onTitle(e.target.value)}
          placeholder={placeholder}
        />
      </Field>
    </div>
  )
}

// ─── 목표 ───────────────────────────────────────────────────────
function GoalForm({ plan, formId, onDone, onError }: FormProps<{ kind: 'goal' }>) {
  const [title, setTitle] = useState(plan.goal.title)
  const [emoji, setEmoji] = useState(plan.goal.emoji ?? '')
  return (
    <form
      id={formId}
      onSubmit={submitter(() => {
        if (!title.trim()) return onError('목표 이름을 입력해 주세요.')
        onDone({ kind: 'goal', title: title.trim(), emoji: emoji.trim() || null })
      })}
    >
      <EmojiTitle emoji={emoji} title={title} onEmoji={setEmoji} onTitle={setTitle} />
    </form>
  )
}

// ─── 세부 목표 ──────────────────────────────────────────────────
function SubGoalForm({ target, plan, formId, onDone, onError }: FormProps<{ kind: 'subGoal'; index: number | null }>) {
  const current = target.index !== null ? plan.subGoals[target.index] : null
  const [title, setTitle] = useState(current?.title ?? '')
  const [emoji, setEmoji] = useState(current?.emoji ?? '')
  const [description, setDescription] = useState(current?.description ?? '')
  return (
    <form
      id={formId}
      className="space-y-4"
      onSubmit={submitter(() => {
        if (!title.trim()) return onError('제목을 입력해 주세요.')
        onDone({
          kind: 'subGoal',
          index: target.index,
          item: {
            tempId: current?.tempId ?? newTempId('sg'),
            metric: current?.metric ?? null,
            title: title.trim(),
            emoji: emoji.trim() || null,
            description: description.trim() || null,
          },
        })
      })}
    >
      <EmojiTitle emoji={emoji} title={title} onEmoji={setEmoji} onTitle={setTitle} placeholder="예) 식단 관리" />
      <Field label="설명 (선택)">
        <textarea
          rows={3}
          maxLength={200}
          className={textareaClass}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="예) 하루 섭취량 1,800kcal 이하 유지"
        />
      </Field>
    </form>
  )
}

// ─── 마일스톤 ───────────────────────────────────────────────────
function MilestoneForm({
  target,
  plan,
  formId,
  onDone,
  onError,
}: FormProps<{ kind: 'milestone'; index: number | null }>) {
  const current = target.index !== null ? plan.milestones[target.index] : null
  const [title, setTitle] = useState(current?.title ?? '')
  const [description, setDescription] = useState(current?.description ?? '')
  const [dueDate, setDueDate] = useState(current?.dueDate ?? '')
  const [targetValue, setTargetValue] = useState(current?.targetValue?.toString() ?? '')
  const metric = plan.goal.metric

  return (
    <form
      id={formId}
      className="space-y-4"
      onSubmit={submitter(() => {
        if (!title.trim()) return onError('제목을 입력해 주세요.')
        if (!dueDate) return onError('날짜를 정해 주세요.')
        if (dueDate < plan.goal.startDate || dueDate > plan.goal.endDate)
          return onError('목표 기간 안의 날짜를 골라 주세요.')
        const tv = toNumber(targetValue)
        if (Number.isNaN(tv)) return onError('목표 수치는 숫자로 입력해 주세요.')
        onDone({
          kind: 'milestone',
          index: target.index,
          item: {
            tempId: current?.tempId ?? newTempId('ms'),
            title: title.trim(),
            description: description.trim() || null,
            dueDate,
            targetValue: tv,
          },
        })
      })}
    >
      <Field label="제목">
        <input
          autoFocus
          className={inputClass}
          value={title}
          maxLength={LIMITS.title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예) 적응기: 습관 세팅"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="날짜">
          <input
            type="date"
            className={inputClass}
            value={dueDate}
            min={plan.goal.startDate}
            max={plan.goal.endDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </Field>
        {metric && (
          <Field label={`목표 ${metric.name} (${metric.unit})`}>
            <input
              className={inputClass}
              inputMode="decimal"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
            />
          </Field>
        )}
      </div>
      <Field label="설명 (선택)">
        <textarea
          rows={2}
          maxLength={200}
          className={textareaClass}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
    </form>
  )
}

// ─── Task (루틴 / 일회성) ───────────────────────────────────────
function TaskForm({
  target,
  plan,
  formId,
  onDone,
  onError,
}: FormProps<{ kind: 'task'; index: number | null; taskType: PlanTask['type'] }>) {
  const current = target.index !== null ? plan.tasks[target.index] : null
  const routine = target.taskType === 'ROUTINE'
  const [limitMin, limitMax] = routine ? LIMITS.routineMinutes : LIMITS.oneTimeMinutes

  const [title, setTitle] = useState(current?.title ?? '')
  const [emoji, setEmoji] = useState(current?.emoji ?? '')
  const [minutes, setMinutes] = useState(String(current?.durationMinutes ?? (routine ? 20 : 30)))
  const [subGoalId, setSubGoalId] = useState(current?.subGoalTempId ?? plan.subGoals[0]?.tempId ?? '')
  // 루틴
  const [days, setDays] = useState<DayOfWeek[]>(current?.routineDays ?? [])
  const [startTime, setStartTime] = useState(current?.preferredStartTime ?? '')
  // 일회성
  const [milestoneId, setMilestoneId] = useState(current?.milestoneTempId ?? '')
  const [scheduledDate, setScheduledDate] = useState(current?.scheduledDate ?? '')
  const [dueDate, setDueDate] = useState(current?.dueDate ?? '')

  const milestone = plan.milestones.find((m) => m.tempId === milestoneId)
  const maxDue = milestone?.dueDate ?? plan.goal.endDate

  const toggleDay = (d: DayOfWeek) => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))

  const submit = () => {
    if (!title.trim()) return onError('제목을 입력해 주세요.')
    const m = Number(minutes)
    if (!Number.isInteger(m) || m < limitMin || m > limitMax)
      return onError(`${routine ? '루틴' : '할 일'}은 ${limitMin}~${limitMax}분으로 설정해 주세요.`)

    const base = {
      tempId: current?.tempId ?? newTempId('t'),
      type: target.taskType,
      subGoalTempId: subGoalId || null,
      title: title.trim(),
      emoji: emoji.trim() || null,
      durationMinutes: m,
    }

    if (routine) {
      if (!days.length) return onError('요일을 하나 이상 골라 주세요.')
      return onDone({
        kind: 'task',
        index: target.index,
        item: {
          ...base,
          milestoneTempId: current?.milestoneTempId ?? null,
          routineDays: DAYS.filter((d) => days.includes(d)),
          preferredStartTime: startTime || null,
          startDate: current?.startDate ?? plan.goal.startDate,
          endDate: current?.endDate ?? null,
          scheduledDate: null,
          dueDate: null,
        },
      })
    }

    if (!dueDate) return onError('마감일을 정해 주세요.')
    if (scheduledDate && scheduledDate > dueDate) return onError('실행일은 마감일보다 늦을 수 없어요.')
    if (dueDate > maxDue)
      return onError(
        milestone
          ? `마감일은 연결된 마일스톤(${formatMd(milestone.dueDate, false)})보다 늦을 수 없어요.`
          : '마감일은 목표 종료일보다 늦을 수 없어요.'
      )
    onDone({
      kind: 'task',
      index: target.index,
      item: {
        ...base,
        milestoneTempId: milestoneId || null,
        routineDays: null,
        preferredStartTime: null,
        startDate: null,
        endDate: null,
        scheduledDate: scheduledDate || null,
        dueDate,
      },
    })
  }

  return (
    <form id={formId} className="space-y-4" onSubmit={submitter(submit)}>
      <EmojiTitle
        emoji={emoji}
        title={title}
        onEmoji={setEmoji}
        onTitle={setTitle}
        placeholder={routine ? '예) 유산소 40분' : '예) 인바디 측정하기'}
      />

      <div className="grid grid-cols-2 gap-3">
        <Field label="걸리는 시간 (분)" hint={`${limitMin}~${limitMax}분`}>
          <input
            type="number"
            min={limitMin}
            max={limitMax}
            className={inputClass}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </Field>
        <Field label="세부 목표">
          <select className={inputClass} value={subGoalId} onChange={(e) => setSubGoalId(e.target.value)}>
            {plan.subGoals.map((sg) => (
              <option key={sg.tempId} value={sg.tempId}>
                {sg.emoji} {sg.title}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {routine ? (
        <>
          <div>
            <span className="text-ink-2 mb-1.5 block text-[13px] font-semibold">반복 요일</span>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d) => (
                <Chip key={d} size="sm" selected={days.includes(d)} onClick={() => toggleDay(d)} className="w-10">
                  {DAY_LABEL[d]}
                </Chip>
              ))}
            </div>
          </div>
          <Field label="시작 시각 (선택)">
            <input
              type="time"
              className={inputClass}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </Field>
        </>
      ) : (
        <>
          <Field label="마일스톤 (선택)">
            <select className={inputClass} value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
              <option value="">연결 안 함</option>
              {plan.milestones.map((ms) => (
                <option key={ms.tempId} value={ms.tempId}>
                  {ms.title} (~{formatMd(ms.dueDate, false)})
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="실행일 (선택)">
              <input
                type="date"
                className={inputClass}
                value={scheduledDate}
                min={plan.goal.startDate}
                max={dueDate || maxDue}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </Field>
            <Field label="마감일">
              <input
                type="date"
                className={inputClass}
                value={dueDate}
                min={scheduledDate || plan.goal.startDate}
                max={maxDue}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </Field>
          </div>
        </>
      )}
    </form>
  )
}

// ─── 모달 ───────────────────────────────────────────────────────

function titleOf(target: EditTarget): string {
  const isNew = 'index' in target && target.index === null
  const name =
    target.kind === 'goal'
      ? '목표'
      : target.kind === 'subGoal'
        ? '세부 목표'
        : target.kind === 'milestone'
          ? '마일스톤'
          : target.taskType === 'ROUTINE'
            ? '루틴'
            : '할 일'
  return `${name} ${isNew ? '추가' : '수정'}`
}

interface ItemEditModalProps {
  target: EditTarget | null
  plan: GoalPlan
  onClose: () => void
  onSave: (result: EditResult) => void
  /** 기존 항목 삭제. 최소 개수 등으로 지울 수 없으면 undefined */
  onDelete?: () => void
  deleteDisabledReason?: string | null
}

export function ItemEditModal({ target, plan, onClose, onSave, onDelete, deleteDisabledReason }: ItemEditModalProps) {
  const [error, setError] = useState<string | null>(null)
  const formId = 'plan-item-form'

  const close = () => {
    setError(null)
    onClose()
  }
  const done = (result: EditResult) => {
    setError(null)
    onSave(result)
  }

  const formProps = { plan, formId, onDone: done, onError: setError }
  const key = target ? JSON.stringify(target) : 'none'
  const canDelete = target && 'index' in target && target.index !== null && onDelete

  return (
    <Modal
      open={!!target}
      onClose={close}
      title={target ? titleOf(target) : undefined}
      footer={
        <div className="flex w-full items-center gap-2">
          {canDelete && (
            <Button
              variant="ghost"
              className="text-danger hover:bg-danger-soft mr-auto"
              onClick={() => {
                if (deleteDisabledReason) return setError(deleteDisabledReason)
                setError(null)
                onDelete()
              }}
            >
              <Trash2 className="size-4" />
              삭제
            </Button>
          )}
          <Button variant="secondary" className="ml-auto" onClick={close}>
            취소
          </Button>
          <Button type="submit" form={formId}>
            저장
          </Button>
        </div>
      }
    >
      {target?.kind === 'goal' && <GoalForm key={key} target={target} {...formProps} />}
      {target?.kind === 'subGoal' && <SubGoalForm key={key} target={target} {...formProps} />}
      {target?.kind === 'milestone' && <MilestoneForm key={key} target={target} {...formProps} />}
      {target?.kind === 'task' && <TaskForm key={key} target={target} {...formProps} />}
      {error && (
        <p role="alert" className="text-danger mt-3 text-sm font-medium">
          {error}
        </p>
      )}
    </Modal>
  )
}
