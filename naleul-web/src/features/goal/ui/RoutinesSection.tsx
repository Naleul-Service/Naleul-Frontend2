'use client'

import { useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { cn } from '@/lib/cn'
import { todayKst } from '@/features/timetable/time'
import type { GoalCategory, JavaDayOfWeek, RoutineSummary } from '../api'
import { useCreateRoutine, useDeleteRoutine, useUpdateRoutine } from '../edit/mutations'
import {
  AddButton,
  DaysPicker,
  Field,
  InlineConfirm,
  InlineForm,
  RowActions,
  inlineInput,
  useEditing,
} from '../edit/inline'
import { JAVA_DAYS, JAVA_DAY_LABEL, hhmm } from '../format'
import { Section } from './sections'
import { activeSubGoals, defaultPeriod } from './SubGoalsSection'

function DayChips({ days }: { days: JavaDayOfWeek[] }) {
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

function RoutineForm({
  goal,
  routine,
  subGoalId,
  onDone,
  onNeedSubGoal,
}: {
  goal: GoalCategory
  /** 없으면 새로 추가 */
  routine?: RoutineSummary
  subGoalId?: number
  onDone: () => void
  onNeedSubGoal: () => void
}) {
  const subs = activeSubGoals(goal)
  const create = useCreateRoutine(goal.goalCategoryId)
  const update = useUpdateRoutine()
  const period = defaultPeriod(goal)
  const today = todayKst()

  const [name, setName] = useState(routine?.routineName ?? '')
  const [sub, setSub] = useState<number | null>(subGoalId ?? subs[0]?.generalCategoryId ?? null)
  const [days, setDays] = useState<JavaDayOfWeek[]>(routine?.repeatDays?.length ? routine.repeatDays : JAVA_DAYS)
  const [startTime, setStartTime] = useState(hhmm(routine?.repeatStartTime ?? null) ?? '')
  const [endTime, setEndTime] = useState(hhmm(routine?.repeatEndTime ?? null) ?? '')
  const [start, setStart] = useState(routine?.repeatStartDate ?? (period.start < today ? today : period.start))
  const [end, setEnd] = useState(routine?.repeatEndDate ?? (period.end < today ? today : period.end))
  const [notify, setNotify] = useState(routine?.notificationEnabled ?? true)
  const [howTo, setHowTo] = useState(routine?.description ?? '')

  if (!subs.length) {
    return (
      <div className="bg-canvas flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3 text-sm">
        <span className="text-ink-2 flex-1">루틴은 세부 목표 아래에 만들어요. 세부 목표를 먼저 추가해 주세요.</span>
        <button type="button" onClick={onNeedSubGoal} className="text-brand font-semibold">
          세부 목표 추가
        </button>
        <button type="button" onClick={onDone} className="text-ink-3">
          닫기
        </button>
      </div>
    )
  }

  const hadTime = !!routine?.repeatStartTime
  const oneTimeOnly = !!startTime !== !!endTime
  const error = !name.trim()
    ? null
    : !days.length
      ? '요일을 하나 이상 골라 주세요.'
      : oneTimeOnly
        ? '시작·종료 시간을 함께 입력하거나 둘 다 비워 주세요.'
        : startTime && endTime && startTime >= endTime
          ? '종료 시간이 시작 시간보다 늦어야 해요. (자정을 넘기는 루틴은 아직 안 돼요)'
          : hadTime && !startTime
            ? '이미 정한 시간은 비울 수 없어요. 시간 없이 하려면 루틴을 다시 만들어 주세요.'
            : !start || !end || start > end
              ? '반복 기간을 확인해 주세요.'
              : null
  const valid = !!name.trim() && !!sub && !error

  const submit = () => {
    const body = {
      generalCategoryId: sub!,
      routineName: name.trim(),
      repeatStartDate: start,
      repeatEndDate: end,
      repeatDays: days,
      repeatStartTime: startTime || null,
      repeatEndTime: endTime || null,
      notificationEnabled: notify,
      description: howTo.trim(),
    }
    if (routine) update.mutate({ id: routine.routineId, ...body }, { onSuccess: onDone })
    else create.mutate(body, { onSuccess: onDone })
  }

  return (
    <InlineForm
      onSubmit={submit}
      onCancel={onDone}
      saving={create.isPending || update.isPending}
      valid={valid}
      error={error}
      submitLabel={routine ? '저장' : '추가'}
      extra={
        <button
          type="button"
          onClick={() => setNotify((v) => !v)}
          aria-pressed={notify}
          className={cn(
            'flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-semibold',
            notify ? 'text-brand hover:bg-brand-soft' : 'text-ink-3 hover:bg-subtle'
          )}
        >
          {notify ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />}
          알림 {notify ? '켜짐' : '꺼짐'}
        </button>
      }
    >
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
        <Field label="루틴 이름">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            placeholder="예: 아침 스트레칭"
            className={inlineInput}
          />
        </Field>
        <Field label="세부 목표">
          <select value={sub ?? ''} onChange={(e) => setSub(Number(e.target.value))} className={inlineInput}>
            {subs.map((s) => (
              <option key={s.generalCategoryId} value={s.generalCategoryId}>
                {s.generalCategoryName}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="반복 요일">
        <DaysPicker value={days} onChange={setDays} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="시작 시간 (선택)">
          <input
            type="time"
            step={600}
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={inlineInput}
          />
        </Field>
        <Field label="종료 시간 (선택)">
          <input
            type="time"
            step={600}
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={inlineInput}
          />
        </Field>
        <Field label="반복 시작일">
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inlineInput} />
        </Field>
        <Field label="반복 종료일">
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inlineInput} />
        </Field>
      </div>
      <Field label="하는 방법 (선택)">
        <textarea
          value={howTo}
          onChange={(e) => setHowTo(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="예) 스쿼트 4x10 → 런지 3x12(각), 세트 사이 60초 휴식 · Shift+Enter 로 줄바꿈"
          className={`${inlineInput} h-auto resize-none py-2 leading-relaxed`}
        />
      </Field>
      <p className="text-ink-3 text-xs">
        {startTime ? '정한 시간에 매번 고정돼요.' : '시간을 비워 두면 자동 배치가 빈 시간에 넣어 줘요.'}
        {routine && ' 저장하면 오늘 이후의 루틴 Task가 새 설정으로 바뀌어요 (지난 기록은 그대로).'}
      </p>
    </InlineForm>
  )
}

function RoutineRow({
  goal,
  routine,
  subGoal,
  subGoalId,
}: {
  goal: GoalCategory
  routine: RoutineSummary
  subGoal: string
  subGoalId: number
}) {
  const key = `routine:${routine.routineId}`
  const edit = useEditing(key)
  const del = useEditing(`del:${key}`)
  const addSub = useEditing('sub:new')
  const remove = useDeleteRoutine()
  const start = hhmm(routine.repeatStartTime)
  const end = hhmm(routine.repeatEndTime)

  if (edit.isOpen) {
    return (
      <li className="py-2">
        <RoutineForm
          goal={goal}
          routine={routine}
          subGoalId={subGoalId}
          onDone={edit.close}
          onNeedSubGoal={addSub.open}
        />
      </li>
    )
  }
  if (del.isOpen) {
    return (
      <li className="py-2">
        <InlineConfirm
          message={`'${routine.routineName}' 루틴을 삭제할까요?`}
          detail="이 루틴으로 만들어진 Task도 함께 삭제돼요."
          loading={remove.isPending}
          onCancel={del.close}
          onConfirm={() => remove.mutate(routine.routineId, { onSuccess: del.close })}
        />
      </li>
    )
  }
  return (
    <li className="group flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
      <button type="button" onClick={edit.open} className="min-w-0 flex-1 basis-[55%] text-left">
        <p className="flex items-center gap-1.5 text-[15px] font-semibold">
          {routine.routineName}
          {routine.notificationEnabled && <Bell className="text-ink-3 size-3.5" aria-label="알림 켜짐" />}
        </p>
        <p className="text-ink-3 mt-0.5 text-[13px]">
          {subGoal}
          {start ? ` · ${start}${end ? `~${end}` : ''}` : ' · 시간 자동'}
          {!start && routine.durationMinutes ? ` · ${routine.durationMinutes}분` : ''}
        </p>
        {routine.description && (
          <p className="bg-subtle text-ink-2 mt-2 rounded-lg px-2.5 py-1.5 text-[13px] leading-relaxed whitespace-pre-wrap">
            {routine.description}
          </p>
        )}
      </button>
      {/* 좁은 화면에선 요일을 아랫줄로 */}
      <div className="order-3 w-full sm:order-none sm:w-auto">
        <DayChips days={routine.repeatDays} />
      </div>
      <RowActions label={routine.routineName} onEdit={edit.open} onDelete={del.open} />
    </li>
  )
}

/** 루틴 — 줄을 누르면 그 자리에서 수정, 아래 점선 버튼으로 추가 */
export function RoutinesSection({ goal }: { goal: GoalCategory }) {
  const add = useEditing('routine:new')
  const addSub = useEditing('sub:new')
  const rows = activeSubGoals(goal).flatMap((sg) =>
    sg.routines.map((r) => ({ routine: r, subGoal: sg.generalCategoryName, subGoalId: sg.generalCategoryId }))
  )

  return (
    <Section title="루틴" aside={`${rows.length}개`}>
      {rows.length > 0 && (
        <ul className="divide-line divide-y">
          {rows.map(({ routine, subGoal, subGoalId }) => (
            <RoutineRow key={routine.routineId} goal={goal} routine={routine} subGoal={subGoal} subGoalId={subGoalId} />
          ))}
        </ul>
      )}
      <div className={rows.length ? 'mt-3' : ''}>
        {add.isOpen ? (
          <RoutineForm goal={goal} onDone={add.close} onNeedSubGoal={addSub.open} />
        ) : (
          <AddButton onClick={add.open}>루틴 추가</AddButton>
        )}
      </div>
    </Section>
  )
}
