'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronDown, Repeat, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge, Chip } from '@/components/ui/Chip'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { hexOf, shownTime } from '@/features/timetable/layout'
import { WEEKDAY_LABEL, addDays, hm, todayKst, weekdayIndex } from '@/features/timetable/time'
import type { TimeBlockTask } from '@/features/timetable/types'
import { useGoalTasks, useToggleGoalTask, type GoalCategory } from '../api'
import { useDeleteGoalTask } from '../edit/mutations'
import { AddButton, InlineConfirm, RowActions, useEditing } from '../edit/inline'
import { GoalTaskForm } from './GoalTaskForm'

type StatusFilter = 'ALL' | 'TODO' | 'DONE'
type KindFilter = 'ALL' | 'ONE_TIME' | 'ROUTINE'

const PAGE = 20

const isDone = (t: TimeBlockTask) => t.taskStatus === 'COMPLETED'

const matchKind = (t: TimeBlockTask, k: KindFilter) =>
  k === 'ALL' || (k === 'ROUTINE' ? t.sourceType === 'ROUTINE' : t.sourceType !== 'ROUTINE')

const matchStatus = (t: TimeBlockTask, s: StatusFilter) => s === 'ALL' || (s === 'DONE' ? isDone(t) : !isDone(t))

/** 이 Task 가 화면에 놓이는 날짜 (완료 후 실제 → 계획 → 시간 미정 날짜 → 권장일 → 마감일) */
const dayOf = (t: TimeBlockTask) => shownTime(t)?.startAt.slice(0, 10) ?? t.date ?? t.scheduledDate ?? t.dueDate ?? null

/** "오늘" · "내일" · "어제" · "10.08 (목)" (해가 다르면 "2027.01.03 (일)") */
function dayLabel(ymd: string, today: string) {
  if (ymd === today) return '오늘'
  if (ymd === addDays(today, 1)) return '내일'
  if (ymd === addDays(today, -1)) return '어제'
  const md = `${ymd.slice(5, 7)}.${ymd.slice(8, 10)}`
  const date = ymd.slice(0, 4) === today.slice(0, 4) ? md : `${ymd.slice(0, 4)}.${md}`
  return `${date} (${WEEKDAY_LABEL[weekdayIndex(ymd)]})`
}

/** 한 줄 — 수정(일회성 Task 만)·삭제(미션 제외)는 그 줄이 입력창/확인창으로 바뀌어요 */
function TaskItem(props: {
  goal: GoalCategory
  task: TimeBlockTask
  today: string
  onToggle: (t: TimeBlockTask) => void
  toggling: boolean
}) {
  const t = props.task
  const key = `task:${t.taskId}`
  const edit = useEditing(key)
  const del = useEditing(`del:${key}`)
  const addSub = useEditing('sub:new')
  const remove = useDeleteGoalTask()

  if (edit.isOpen) {
    return (
      <li className="py-2">
        <GoalTaskForm goal={props.goal} task={t} onDone={edit.close} onNeedSubGoal={addSub.open} />
      </li>
    )
  }
  if (del.isOpen) {
    return (
      <li className="py-2">
        <InlineConfirm
          message={`'${t.taskName}'을 삭제할까요?`}
          detail={t.sourceType === 'ROUTINE' ? '이 날짜의 루틴 Task 하나만 지워져요. 루틴은 그대로예요.' : undefined}
          loading={remove.isPending}
          onCancel={del.close}
          onConfirm={() => remove.mutate(t.taskId, { onSuccess: del.close })}
        />
      </li>
    )
  }
  return (
    <TaskRow
      {...props}
      onEdit={t.sourceType === 'MANUAL' ? edit.open : undefined}
      onDelete={t.sourceType !== 'MISSION' ? del.open : undefined}
    />
  )
}

function TaskRow({
  task: t,
  today,
  onToggle,
  toggling,
  onEdit,
  onDelete,
}: {
  task: TimeBlockTask
  today: string
  onToggle: (t: TimeBlockTask) => void
  toggling: boolean
  onEdit?: () => void
  onDelete?: () => void
}) {
  const done = isDone(t)
  const shown = shownTime(t)
  const day = dayOf(t)
  const time = shown ? `${hm(shown.startAt)}${shown.endAt ? `–${hm(shown.endAt)}` : ''}` : '시간 미정'
  const sub = [t.generalCategoryName, t.milestoneTitle].filter(Boolean).join(' · ')

  return (
    <li className="group flex items-center gap-3 py-3">
      <button
        type="button"
        onClick={() => onToggle(t)}
        disabled={toggling}
        aria-label={done ? `${t.taskName} 완료 취소` : `${t.taskName} 완료`}
        aria-pressed={done}
        className={cn(
          'grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors disabled:opacity-50',
          done ? 'border-success bg-success text-white' : 'border-line-strong hover:border-ink-4'
        )}
      >
        {toggling ? <Spinner className="size-3" /> : done && <Check className="size-3.5" strokeWidth={3.5} />}
      </button>

      {/* 날짜 */}
      <div className="w-[88px] shrink-0">
        <p
          className={cn(
            'text-[13px] font-semibold',
            day === today && !done ? 'text-brand' : t.missed ? 'text-danger' : done ? 'text-ink-4' : 'text-ink-2'
          )}
        >
          {day ? dayLabel(day, today) : '날짜 미정'}
        </p>
        <p className="text-ink-4 text-[11px] whitespace-nowrap tabular-nums">
          {shown?.actual && '실제 '}
          {time}
        </p>
      </div>

      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: hexOf(t.goalColorCode) }} />

      <div className="min-w-0 flex-1">
        {day ? (
          <Link
            href={`/calendar?view=day&date=${day}`}
            className={cn(
              'block truncate text-[15px] font-semibold hover:underline',
              done && 'text-ink-4 line-through'
            )}
          >
            {t.emoji ? `${t.emoji} ` : ''}
            {t.taskName}
          </Link>
        ) : (
          <p className={cn('truncate text-[15px] font-semibold', done && 'text-ink-4 line-through')}>
            {t.emoji ? `${t.emoji} ` : ''}
            {t.taskName}
          </p>
        )}
        {sub && <p className="text-ink-3 mt-0.5 truncate text-[12px]">{sub}</p>}
      </div>

      <div className="hidden shrink-0 items-center gap-1 sm:flex">
        {t.missed && <Badge tone="danger">놓침</Badge>}
        {t.taskStatus === 'SKIPPED' && <Badge>건너뜀</Badge>}
        {t.sourceType === 'ROUTINE' && (
          <Badge>
            <Repeat className="size-3" />
            루틴
          </Badge>
        )}
        {t.source === 'AI_GOAL' && (
          <Badge tone="brand">
            <Sparkles className="size-3" />
            AI
          </Badge>
        )}
      </div>
      <RowActions label={t.taskName} onEdit={onEdit} onDelete={onDelete} />
    </li>
  )
}

/**
 * 목표 상세 · 관련 Task 전체.
 * AI 가 만든 Task · 직접 추가한 Task · 루틴 Task 를 한 번에 보고, 완료/미완료 · 할 일/루틴으로 거를 수 있어요.
 * 정렬은 서버 순서 그대로: 미완료 위 · 오늘과 가까운 날짜일수록 위 · 완료는 아래.
 */
export function GoalTaskList({ goal }: { goal: GoalCategory }) {
  const goalId = goal.goalCategoryId
  const { data, isPending, isError, refetch } = useGoalTasks(goalId)
  const add = useEditing('task:new')
  const addSub = useEditing('sub:new')
  const toggle = useToggleGoalTask(goalId)
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const [kind, setKind] = useState<KindFilter>('ALL')
  const [limit, setLimit] = useState(PAGE)
  const today = todayKst()

  const all = data?.tasks ?? []
  const byKind = all.filter((t) => matchKind(t, kind))
  const shown = byKind.filter((t) => matchStatus(t, status))
  const visible = shown.slice(0, limit)
  const counts = {
    ALL: byKind.length,
    TODO: byKind.filter((t) => !isDone(t)).length,
    DONE: byKind.filter(isDone).length,
  }
  const hasRoutine = all.some((t) => t.sourceType === 'ROUTINE')
  const firstDoneId = status === 'ALL' ? visible.find(isDone)?.taskId : undefined

  const pickStatus = (s: StatusFilter) => {
    setStatus(s)
    setLimit(PAGE)
  }
  const pickKind = (k: KindFilter) => {
    setKind(k)
    setLimit(PAGE)
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[17px] font-bold">관련 Task</h2>
        {data && (
          <span className="text-ink-3 text-[13px]">
            {data.completedCount} / {data.totalCount} 완료
          </span>
        )}
      </div>

      {/* 추가: 이름·날짜만 넣고 Enter */}
      <div className="mb-4">
        {add.isOpen ? (
          <GoalTaskForm goal={goal} onDone={add.close} onNeedSubGoal={addSub.open} />
        ) : (
          <AddButton onClick={add.open}>Task 추가</AddButton>
        )}
      </div>

      {isPending ? (
        <div className="grid min-h-[120px] place-items-center">
          <Spinner className="text-ink-3 size-5" />
        </div>
      ) : isError ? (
        <div className="text-ink-3 py-6 text-center text-sm">
          Task를 불러오지 못했어요.{' '}
          <button type="button" className="text-ink-2 font-semibold underline" onClick={() => refetch()}>
            다시 시도
          </button>
        </div>
      ) : all.length === 0 ? (
        <p className="text-ink-3 py-4 text-center text-sm">
          이 목표에 연결된 Task가 아직 없어요. 위에서 바로 추가해 보세요.
        </p>
      ) : (
        <>
          {/* 필터 */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['ALL', '전체'],
                ['TODO', '미완료'],
                ['DONE', '완료'],
              ] as const
            ).map(([key, label]) => (
              <Chip key={key} size="sm" selected={status === key} onClick={() => pickStatus(key)}>
                {label} {counts[key]}
              </Chip>
            ))}
            {hasRoutine && (
              <>
                <span className="bg-line mx-1 h-4 w-px" aria-hidden />
                {(
                  [
                    ['ALL', '모두'],
                    ['ONE_TIME', '할 일'],
                    ['ROUTINE', '루틴'],
                  ] as const
                ).map(([key, label]) => (
                  <Chip key={key} size="sm" selected={kind === key} onClick={() => pickKind(key)}>
                    {label}
                  </Chip>
                ))}
              </>
            )}
          </div>

          {shown.length === 0 ? (
            <p className="text-ink-3 py-8 text-center text-sm">
              {status === 'DONE' ? '아직 완료한 Task가 없어요.' : '남은 Task가 없어요. 모두 끝냈어요! 🎉'}
            </p>
          ) : (
            <ul className="divide-line mt-3 divide-y">
              {visible.map((t) => (
                <Fragment key={t.taskId}>
                  {/* 전체 보기에서 미완료와 완료 사이 구분선 */}
                  {t.taskId === firstDoneId && (
                    <li className="text-ink-3 pt-5 pb-1 text-xs font-semibold">완료한 Task</li>
                  )}
                  <TaskItem
                    goal={goal}
                    task={t}
                    today={today}
                    onToggle={(x) => toggle.mutate(x)}
                    toggling={toggle.isPending && toggle.variables?.taskId === t.taskId}
                  />
                </Fragment>
              ))}
            </ul>
          )}

          {shown.length > visible.length && (
            <button
              type="button"
              onClick={() => setLimit((n) => n + PAGE)}
              className="text-ink-2 hover:bg-subtle mt-2 flex w-full items-center justify-center gap-1 rounded-xl py-2.5 text-sm font-semibold"
            >
              더 보기 ({shown.length - visible.length}개 남음)
              <ChevronDown className="size-4" />
            </button>
          )}
        </>
      )}
    </Card>
  )
}
