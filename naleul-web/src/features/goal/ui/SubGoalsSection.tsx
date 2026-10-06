'use client'

import { useState } from 'react'
import { useUserColors } from '@/features/color/api'
import { todayKst } from '@/features/timetable/time'
import type { GoalCategory, SubGoalInfo } from '../api'
import { useCreateSubGoal, useDeleteSubGoal, useUpdateSubGoal } from '../edit/mutations'
import {
  AddButton,
  ColorSwatches,
  Field,
  InlineConfirm,
  InlineForm,
  RowActions,
  colorIdOf,
  inlineInput,
  useEditing,
} from '../edit/inline'
import { formatDot, goalColor } from '../format'
import { Section } from './sections'

/** 화면에 보여줄 세부 목표 (삭제된 것 제외 — 백엔드가 소프트 삭제된 것도 내려줘요) */
export const activeSubGoals = (goal: GoalCategory) =>
  goal.generalCategories.filter((sg) => sg.generalCategoryStatus !== 'DELETED')

/** 새로 만들 때 기본 기간: 목표 기간 (없으면 오늘부터 4주) */
export function defaultPeriod(goal: GoalCategory) {
  const today = todayKst()
  const start = goal.goalCategoryStartDate ?? today
  const end = goal.goalCategoryEndDate ?? start
  return { start, end: end < start ? start : end }
}

function SubGoalForm({
  goal,
  sub,
  onDone,
}: {
  goal: GoalCategory
  /** 없으면 새로 추가 */
  sub?: SubGoalInfo
  onDone: () => void
}) {
  const colors = useUserColors()
  const create = useCreateSubGoal(goal.goalCategoryId)
  const update = useUpdateSubGoal()
  const period = defaultPeriod(goal)
  const [name, setName] = useState(sub?.generalCategoryName ?? '')
  const [start, setStart] = useState(sub?.generalCategoryStartDate ?? period.start)
  const [end, setEnd] = useState(sub?.generalCategoryEndDate ?? period.end)
  const [colorId, setColorId] = useState<number | null>(null)
  const effectiveColor = colorId ?? colorIdOf(colors.data, sub?.colorCode ?? goal.colorCode)

  const error = !name.trim()
    ? null
    : !start || !end
      ? '기간을 입력해 주세요.'
      : start > end
        ? '종료일이 시작일보다 빨라요.'
        : null
  const valid = !!name.trim() && !error && effectiveColor !== null

  const submit = () => {
    const body = {
      generalCategoryName: name.trim(),
      generalCategoryStartDate: start,
      generalCategoryEndDate: end,
    }
    if (sub) {
      update.mutate(
        { id: sub.generalCategoryId, ...body, ...(colorId !== null ? { colorId } : {}) },
        { onSuccess: onDone }
      )
    } else {
      create.mutate({ ...body, colorId: effectiveColor! }, { onSuccess: onDone })
    }
  }

  return (
    <InlineForm
      onSubmit={submit}
      onCancel={onDone}
      saving={create.isPending || update.isPending}
      valid={valid}
      error={error}
      submitLabel={sub ? '저장' : '추가'}
    >
      <Field label="세부 목표 이름">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          placeholder="예: 식단 관리, 단어 외우기"
          className={inlineInput}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="시작일">
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inlineInput} />
        </Field>
        <Field label="종료일">
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inlineInput} />
        </Field>
      </div>
      <Field label="색상">
        <ColorSwatches colors={colors.data} value={effectiveColor} onChange={setColorId} />
      </Field>
    </InlineForm>
  )
}

function SubGoalCard({ goal, sub }: { goal: GoalCategory; sub: SubGoalInfo }) {
  const key = `sub:${sub.generalCategoryId}`
  const edit = useEditing(key)
  const del = useEditing(`del:${key}`)
  const remove = useDeleteSubGoal()

  if (edit.isOpen) {
    return (
      <div className="sm:col-span-2 xl:col-span-3">
        <SubGoalForm goal={goal} sub={sub} onDone={edit.close} />
      </div>
    )
  }
  if (del.isOpen) {
    return (
      <div className="sm:col-span-2 xl:col-span-3">
        <InlineConfirm
          message={`'${sub.generalCategoryName}'을 삭제할까요?`}
          detail={
            sub.routines.length
              ? `루틴 ${sub.routines.length}개와 그 루틴의 Task도 함께 삭제돼요.`
              : '이 세부 목표에 연결된 일회성 Task는 남아요.'
          }
          loading={remove.isPending}
          onCancel={del.close}
          onConfirm={() => remove.mutate(sub.generalCategoryId, { onSuccess: del.close })}
        />
      </div>
    )
  }
  return (
    <div className="group bg-canvas relative rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <span
          className="mt-1.5 block h-1 w-8 rounded-full"
          style={{ backgroundColor: goalColor(sub.colorCode ?? goal.colorCode) }}
        />
        <RowActions label={sub.generalCategoryName} onEdit={edit.open} onDelete={del.open} className="-mt-1 -mr-1" />
      </div>
      <button type="button" onClick={edit.open} className="mt-2 block w-full text-left">
        <p className="text-[15px] font-bold">{sub.generalCategoryName}</p>
        <p className="text-ink-3 mt-1 text-[13px]">
          루틴 {sub.routines.length}개
          {sub.generalCategoryStartDate && (
            <span className="text-ink-4">
              {' '}
              · {formatDot(sub.generalCategoryStartDate).slice(5)}–{formatDot(sub.generalCategoryEndDate).slice(5)}
            </span>
          )}
        </p>
      </button>
    </div>
  )
}

/** 세부 목표 — 카드를 누르면 그 자리에서 수정, 아래 점선 버튼으로 추가 */
export function SubGoalsSection({ goal }: { goal: GoalCategory }) {
  const subs = activeSubGoals(goal)
  const add = useEditing('sub:new')

  return (
    <Section title="세부 목표" aside={`${subs.length}개`}>
      {subs.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {subs.map((sg) => (
            <SubGoalCard key={sg.generalCategoryId} goal={goal} sub={sg} />
          ))}
        </div>
      )}
      <div className={subs.length ? 'mt-3' : ''}>
        {add.isOpen ? (
          <SubGoalForm goal={goal} onDone={add.close} />
        ) : (
          <AddButton onClick={add.open}>세부 목표 추가</AddButton>
        )}
      </div>
    </Section>
  )
}
