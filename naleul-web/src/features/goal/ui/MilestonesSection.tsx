'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { Badge } from '@/components/ui/Chip'
import { cn } from '@/lib/cn'
import { addDays, todayKst } from '@/features/timetable/time'
import type { GoalCategory, MilestoneInfo } from '../api'
import { useCreateMilestone, useDeleteMilestone, useUpdateMilestone } from '../edit/mutations'
import { AddButton, Field, InlineConfirm, InlineForm, RowActions, inlineInput, toNum, useEditing } from '../edit/inline'
import { formatDot } from '../format'
import { Section } from './sections'

function MilestoneForm({
  goal,
  milestone,
  onDone,
}: {
  goal: GoalCategory
  milestone?: MilestoneInfo
  onDone: () => void
}) {
  const create = useCreateMilestone(goal.goalCategoryId)
  const update = useUpdateMilestone()
  const unit = goal.metricUnit ?? ''
  // 새 마일스톤 기본 기한: 마지막 마일스톤 + 4주 (없으면 오늘 + 4주), 목표 종료일을 넘지 않게
  const last = [...(goal.milestones ?? [])].sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0]
  let suggested = addDays(last?.dueDate ?? todayKst(), 28)
  if (goal.goalCategoryEndDate && suggested > goal.goalCategoryEndDate) suggested = goal.goalCategoryEndDate

  const [title, setTitle] = useState(milestone?.title ?? '')
  const [dueDate, setDueDate] = useState(milestone?.dueDate ?? suggested)
  const [target, setTarget] = useState(milestone?.targetValue != null ? String(milestone.targetValue) : '')
  const [description, setDescription] = useState(milestone?.description ?? '')

  const targetNum = toNum(target)
  const error = !title.trim()
    ? null
    : !dueDate
      ? '기한을 입력해 주세요.'
      : targetNum !== null && Number.isNaN(targetNum)
        ? '목표 수치는 숫자로 입력해 주세요.'
        : null

  const submit = () => {
    const body = { title: title.trim(), dueDate, targetValue: targetNum, description: description.trim() }
    if (milestone) {
      update.mutate(
        { id: milestone.milestoneId, ...body, clearTargetValue: targetNum === null && milestone.targetValue != null },
        { onSuccess: onDone }
      )
    } else {
      create.mutate(body, { onSuccess: onDone })
    }
  }

  return (
    <InlineForm
      onSubmit={submit}
      onCancel={onDone}
      saving={create.isPending || update.isPending}
      valid={!!title.trim() && !error}
      error={error}
      submitLabel={milestone ? '저장' : '추가'}
    >
      <Field label="마일스톤 이름">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={40}
          placeholder="예: 1개월 차"
          className={inlineInput}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="기한">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inlineInput} />
        </Field>
        <Field label={`목표 수치${unit ? ` (${unit})` : ''} · 선택`}>
          <input
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="예: 76"
            className={inlineInput}
          />
        </Field>
      </div>
      <Field label="설명 (선택)">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={300}
          className={inlineInput}
        />
      </Field>
    </InlineForm>
  )
}

function MilestoneItem({ goal, m, current }: { goal: GoalCategory; m: MilestoneInfo; current: boolean }) {
  const key = `milestone:${m.milestoneId}`
  const edit = useEditing(key)
  const del = useEditing(`del:${key}`)
  const update = useUpdateMilestone()
  const remove = useDeleteMilestone()
  const done = m.status === 'ACHIEVED'
  const unit = goal.metricUnit ?? ''

  if (edit.isOpen || del.isOpen) {
    return (
      <li className="relative -ml-7">
        {edit.isOpen ? (
          <MilestoneForm goal={goal} milestone={m} onDone={edit.close} />
        ) : (
          <InlineConfirm
            message={`'${m.title}'을 삭제할까요?`}
            detail="이 마일스톤에 연결된 Task는 남고 연결만 풀려요."
            loading={remove.isPending}
            onCancel={del.close}
            onConfirm={() => remove.mutate(m.milestoneId, { onSuccess: del.close })}
          />
        )}
      </li>
    )
  }

  return (
    <li className="group relative">
      {/* 동그라미를 누르면 달성 / 달성 취소 */}
      <button
        type="button"
        onClick={() => update.mutate({ id: m.milestoneId, status: done ? 'PENDING' : 'ACHIEVED' })}
        disabled={update.isPending}
        aria-label={done ? `${m.title} 달성 취소` : `${m.title} 달성`}
        title={done ? '달성 취소' : '달성으로 표시'}
        className={cn(
          'absolute top-0.5 -left-7 grid size-5 place-items-center rounded-full border-[3px] transition-colors',
          done
            ? 'border-success bg-success text-white'
            : current
              ? 'border-brand bg-surface hover:bg-brand-soft'
              : 'border-line-strong bg-surface hover:border-success'
        )}
      >
        {done && <Check className="size-2.5" strokeWidth={4} />}
      </button>
      <div className="flex items-start gap-2">
        <button type="button" onClick={edit.open} className="min-w-0 flex-1 text-left">
          <p className={cn('text-xs', m.status === 'MISSED' ? 'text-danger' : 'text-ink-3')}>
            ~{formatDot(m.dueDate)}
            {m.status === 'MISSED' && ' · 기한 지남'}
          </p>
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
        </button>
        <RowActions label={m.title} onEdit={edit.open} onDelete={del.open} />
      </div>
    </li>
  )
}

/** 마일스톤 — 동그라미로 달성 체크, 글자를 누르면 그 자리에서 수정 */
export function MilestonesSection({ goal }: { goal: GoalCategory }) {
  const add = useEditing('milestone:new')
  const milestones = [...(goal.milestones ?? [])].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const today = todayKst()
  const achieved = milestones.filter((m) => m.status === 'ACHIEVED').length
  // 지금 향하고 있는 마일스톤: 아직 달성 안 했고 기한이 남은 것 중 가장 가까운 것
  const currentId = milestones.find((m) => m.status !== 'ACHIEVED' && m.dueDate >= today)?.milestoneId

  return (
    <Section title="마일스톤" aside={milestones.length ? `${achieved} / ${milestones.length} 달성` : undefined}>
      {milestones.length > 0 && (
        <ol className="relative mb-4 space-y-5 pl-7">
          <span className="bg-line-strong absolute top-2 bottom-2 left-[9px] w-0.5" aria-hidden />
          {milestones.map((m) => (
            <MilestoneItem key={m.milestoneId} goal={goal} m={m} current={m.milestoneId === currentId} />
          ))}
        </ol>
      )}
      {add.isOpen ? (
        <MilestoneForm goal={goal} onDone={add.close} />
      ) : (
        <AddButton onClick={add.open}>마일스톤 추가</AddButton>
      )}
    </Section>
  )
}
