'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { formatDuration, hm, timeToMinutes, todayKst } from '@/features/timetable/time'
import type { TimeBlockTask } from '@/features/timetable/types'
import type { GoalCategory } from '../api'
import { useCreateGoalTask, useUpdateGoalTask } from '../edit/mutations'
import { Field, InlineForm, inlineInput, toNum } from '../edit/inline'
import { areasOf } from './SubGoalsSection'

/**
 * 목표 상세에서 Task 추가·수정.
 * 이름과 날짜만 넣고 Enter 하면 그날 "시간 미정"으로 들어가고, 자동 배치가 빈 시간에 넣어 줘요.
 * 시간을 넣으면 그 시간에 바로 고정(🔒)돼요 — 다른 고정 일정과 겹치면 저장되지 않아요.
 */
export function GoalTaskForm({
  goal,
  task,
  onDone,
  onCreated,
}: {
  goal: GoalCategory
  /** 없으면 새로 추가 */
  task?: TimeBlockTask
  onDone: () => void
  /** 새로 만든 Task (추가일 때만) — 예: "이날 빈 시간에 배치하기" 안내 */
  onCreated?: (t: TimeBlockTask) => void
}) {
  // 영역은 선택 — 안 고르면 서버가 목표의 "기타 할 일"에 넣어요
  const subs = areasOf(goal)
  const milestones = [...(goal.milestones ?? [])].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const create = useCreateGoalTask(goal.goalCategoryId)
  const update = useUpdateGoalTask(goal.goalCategoryId)

  const [f, setF] = useState(() => ({
    emoji: task?.emoji ?? '',
    name: task?.taskName ?? '',
    date: task?.plannedStartAt?.slice(0, 10) ?? task?.date ?? task?.scheduledDate ?? todayKst(),
    startTime: hm(task?.plannedStartAt),
    endTime: hm(task?.plannedEndAt),
    sub:
      task?.generalCategoryId && subs.some((s) => s.generalCategoryId === task.generalCategoryId)
        ? task.generalCategoryId
        : null,
    milestone: task?.milestoneId ?? null,
    duration: task?.plannedDurationMinutes && !task.plannedStartAt ? String(task.plannedDurationMinutes) : '',
    dueDate: task?.dueDate ?? '',
  }))
  const [more, setMore] = useState(!!(task?.milestoneId || task?.dueDate || (task && !task.plannedStartAt)))
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))

  const hasTime = !!f.startTime && !!f.endTime
  const duration = toNum(f.duration)
  const span = hasTime ? (timeToMinutes(f.endTime) - timeToMinutes(f.startTime) + 1440) % 1440 || 0 : null
  const error = !f.name.trim()
    ? null
    : !f.date
      ? '날짜를 입력해 주세요.'
      : !!f.startTime !== !!f.endTime
        ? '시작·종료 시간을 함께 입력하거나 둘 다 비워 주세요.'
        : hasTime && span === 0
          ? '시작과 종료 시간이 같아요.'
          : !hasTime && duration !== null && (Number.isNaN(duration) || duration < 5 || duration > 720)
            ? '소요 시간은 5~720분으로 입력해 주세요.'
            : null
  const valid = !!f.name.trim() && !error

  const submit = () => {
    const body = {
      taskName: f.name.trim(),
      emoji: f.emoji.trim() || null,
      generalCategoryId: f.sub,
      milestoneId: f.milestone,
      date: f.date,
      startTime: hasTime ? f.startTime : null,
      endTime: hasTime ? f.endTime : null,
      durationMinutes: hasTime ? null : duration,
      dueDate: f.dueDate || null,
    }
    if (task) update.mutate({ taskId: task.taskId, ...body }, { onSuccess: onDone })
    else
      create.mutate(body, {
        onSuccess: (created) => {
          if (created) onCreated?.(created)
          onDone()
        },
      })
  }

  return (
    <InlineForm
      onSubmit={submit}
      onCancel={onDone}
      saving={create.isPending || update.isPending}
      valid={valid}
      error={error}
      submitLabel={task ? '저장' : '추가'}
      extra={
        <button
          type="button"
          onClick={() => setMore((v) => !v)}
          className="text-ink-3 hover:bg-subtle flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-semibold"
        >
          <ChevronDown className={more ? 'size-3.5 rotate-180' : 'size-3.5'} />
          {more ? '간단히' : '더 설정하기'}
        </button>
      }
    >
      <div className="grid grid-cols-[56px_minmax(0,1fr)] gap-2">
        <Field label="이모지">
          <input
            value={f.emoji}
            onChange={(e) => set('emoji', e.target.value)}
            maxLength={16}
            placeholder="📝"
            className={`${inlineInput} text-center placeholder:opacity-40`}
          />
        </Field>
        <Field label="Task 이름">
          <input
            value={f.name}
            onChange={(e) => set('name', e.target.value)}
            maxLength={100}
            placeholder="예: 영단어 50개 외우기"
            className={inlineInput}
            data-autofocus
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="날짜">
          <input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} className={inlineInput} />
        </Field>
        {subs.length > 0 ? (
          <Field label="영역 (선택)">
            <select
              value={f.sub ?? ''}
              onChange={(e) => set('sub', e.target.value ? Number(e.target.value) : null)}
              className={inlineInput}
            >
              <option value="">영역 없음</option>
              {subs.map((s) => (
                <option key={s.generalCategoryId} value={s.generalCategoryId}>
                  {s.generalCategoryName}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <span />
        )}
        <Field label="시작 (선택)">
          <input
            type="time"
            step={600}
            value={f.startTime}
            onChange={(e) => set('startTime', e.target.value)}
            className={inlineInput}
          />
        </Field>
        <Field label="종료 (선택)">
          <input
            type="time"
            step={600}
            value={f.endTime}
            onChange={(e) => set('endTime', e.target.value)}
            className={inlineInput}
          />
        </Field>
      </div>

      {more && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Field label="소요 시간 (분)">
            <input
              inputMode="numeric"
              value={hasTime ? String(span) : f.duration}
              onChange={(e) => set('duration', e.target.value)}
              disabled={hasTime}
              placeholder="30"
              className={`${inlineInput} disabled:bg-subtle disabled:text-ink-3`}
            />
          </Field>
          <Field label="마감일">
            <input
              type="date"
              value={f.dueDate}
              onChange={(e) => set('dueDate', e.target.value)}
              className={inlineInput}
            />
          </Field>
          <Field label="점검 시점" className="col-span-2 sm:col-span-1">
            <select
              value={f.milestone ?? ''}
              onChange={(e) => set('milestone', e.target.value ? Number(e.target.value) : null)}
              className={inlineInput}
            >
              <option value="">없음</option>
              {milestones.map((m) => (
                <option key={m.milestoneId} value={m.milestoneId}>
                  {m.title}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      <p className="text-ink-3 text-xs">
        {hasTime
          ? `${formatDuration(span!)} · 이 시간에 고정돼요${timeToMinutes(f.endTime) < timeToMinutes(f.startTime) ? ' (다음 날까지)' : ''}.`
          : '시간을 비워 두면 그날 빈 시간에 자동으로 배치돼요.'}
      </p>
    </InlineForm>
  )
}
