'use client'

import { useMemo, useState, type MouseEvent } from 'react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Popover, rectOf, type AnchorRect } from '@/components/ui/Popover'
import {
  useCompleteWithActual,
  useDeletePatternOverride,
  useDeleteTask,
  useLifePatterns,
  usePatternOverride,
  useRescheduleTask,
  useToggleComplete,
  useUnlockTask,
  useUnscheduleTask,
} from '../api'
import { applyPending, type Pending } from '../layout'
import { formatMonthDay, minutesFrom, minutesToTime, timeToMinutes, toDateTime } from '../time'
import type { FixedBlock, TimeBlockTask, TimetableDay } from '../types'
import { FixedDetail } from './FixedDetail'
import { TaskDetail } from './TaskDetail'
import { TimeEditModal, type TimeValue } from './TimeEditModal'
import { fixedKey, type Selection } from './TimeGrid'
import type { DragSource, DropTarget } from './useGridDrag'

type Opened =
  | { kind: 'task'; task: TimeBlockTask; anchor: AnchorRect }
  | { kind: 'fixed'; block: FixedBlock; anchor: AnchorRect }
  | null

type Editing =
  | { kind: 'task'; task: TimeBlockTask; initial: TimeValue }
  | { kind: 'fixed'; block: FixedBlock; initial: TimeValue }
  /** 실제로 한 시간 입력 후 완료 */
  | { kind: 'actual'; task: TimeBlockTask; initial: TimeValue }
  | null

/** 고정 블록이 자정을 넘기면(화면엔 24:00까지만) 다음 날 조각이나 패턴에서 실제 종료 시각을 찾아요 */
function fullFixedEnd(block: FixedBlock, days: TimetableDay[], patternEnd?: string) {
  const end = minutesFrom(block.targetDate, block.end)
  if (end < 1440) return end
  const nextPiece = days
    .flatMap((d) => d.fixedBlocks)
    .find(
      (b) => b.clippedFromPreviousDay && b.lifePatternId === block.lifePatternId && b.targetDate === block.targetDate
    )
  if (nextPiece) return minutesFrom(block.targetDate, nextPiece.end)
  if (patternEnd && !block.overridden) return 1440 + timeToMinutes(patternEnd)
  return end
}

/**
 * TimeTable 위에서 하는 모든 조작(상세 팝오버 · 완료 · 시간 변경 · 삭제 · 드래그)을 한곳에 모은 훅.
 * 캘린더(주간·일간·월간)와 Task 추가 3단계 · 내일 확인 화면이 같은 동작을 쓰도록 분리했어요.
 *
 * @param rawDays 서버에서 받은 날짜들 (드래그 직후 임시 위치를 덧입혀서 days 로 돌려줘요)
 * @param fallbackDate 시간 미정 Task 의 시간을 바꿀 때 기본 날짜
 */
export function useTimetableInteractions(rawDays: TimetableDay[], fallbackDate: string) {
  const date = fallbackDate
  const [opened, setOpened] = useState<Opened>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [confirmDelete, setConfirmDelete] = useState<TimeBlockTask | null>(null)
  // 드래그로 옮긴 뒤 서버 응답을 기다리는 동안 새 위치에 그려 둘 블록들
  const [pending, setPending] = useState<Pending[]>([])

  const toggleComplete = useToggleComplete()
  const deleteTask = useDeleteTask()
  const unlock = useUnlockTask()
  const unschedule = useUnscheduleTask()
  const reschedule = useRescheduleTask()
  const completeWithActual = useCompleteWithActual()
  const override = usePatternOverride()
  const resetOverride = useDeletePatternOverride()
  // 자정을 넘기는 고정 시간 수정 때만 필요 → 그때만 불러와요
  const needsPatterns = editing?.kind === 'fixed' || opened?.kind === 'fixed'
  const patterns = useLifePatterns(needsPatterns)

  const days = useMemo(() => applyPending(rawDays, pending, fixedKey), [rawDays, pending])

  // 데이터가 새로 오면 팝오버 안의 Task 도 최신 값으로
  const liveTask = (t: TimeBlockTask) =>
    days.flatMap((d) => [...d.tasks, ...d.unscheduledTasks]).find((x) => x.taskId === t.taskId) ?? t

  const selection: Selection =
    opened?.kind === 'task'
      ? { kind: 'task', id: opened.task.taskId }
      : opened?.kind === 'fixed'
        ? { kind: 'fixed', key: fixedKey(opened.block) }
        : null

  const close = () => setOpened(null)

  // ⚠️ e.currentTarget 은 이벤트 처리 중에만 값이 있어요 → setState 콜백 밖에서 먼저 위치를 읽어 둬요
  const onSelectTask = (task: TimeBlockTask, e: MouseEvent<HTMLElement>) => {
    const anchor = rectOf(e.currentTarget)
    setOpened((o) => (o?.kind === 'task' && o.task.taskId === task.taskId ? null : { kind: 'task', task, anchor }))
  }
  const onSelectFixed = (block: FixedBlock, e: MouseEvent<HTMLElement>) => {
    const anchor = rectOf(e.currentTarget)
    setOpened((o) =>
      o?.kind === 'fixed' && fixedKey(o.block) === fixedKey(block) ? null : { kind: 'fixed', block, anchor }
    )
  }

  // ── Task 작업 ──
  const taskActions = {
    onToggleComplete: (t: TimeBlockTask) => toggleComplete.mutate(t, { onSuccess: close }),
    onEditTime: (t: TimeBlockTask) => {
      close()
      const day = t.plannedStartAt?.slice(0, 10) ?? t.date ?? t.scheduledDate ?? date
      const s = t.plannedStartAt ? minutesFrom(day, t.plannedStartAt) : 9 * 60
      const dur =
        t.plannedEndAt && t.plannedStartAt ? minutesFrom(day, t.plannedEndAt) - s : (t.plannedDurationMinutes ?? 60)
      setEditing({ kind: 'task', task: t, initial: { date: day, start: s, end: s + Math.max(dur, 10) } })
    },
    onCompleteWithTime: (t: TimeBlockTask) => {
      if (!t.plannedStartAt) return
      close()
      const day = t.plannedStartAt.slice(0, 10)
      const s = minutesFrom(day, t.plannedStartAt)
      const e = t.plannedEndAt ? minutesFrom(day, t.plannedEndAt) : s + (t.plannedDurationMinutes ?? 30)
      setEditing({ kind: 'actual', task: t, initial: { date: day, start: s, end: Math.max(e, s + 10) } })
    },
    onUnlock: (t: TimeBlockTask) => unlock.mutate(t.taskId, { onSuccess: close }),
    onUnschedule: (t: TimeBlockTask) => unschedule.mutate(t.taskId, { onSuccess: close }),
    onDelete: (t: TimeBlockTask) => {
      close()
      setConfirmDelete(t)
    },
  }

  // ── 고정 시간 작업 ──
  const fixedActions = {
    onEditTime: (b: FixedBlock) => {
      close()
      const patternEnd = patterns.data?.find((p) => p.lifePatternId === b.lifePatternId)?.endTime
      setEditing({
        kind: 'fixed',
        block: b,
        initial: {
          date: b.targetDate,
          start: minutesFrom(b.targetDate, b.start),
          end: fullFixedEnd(b, days, patternEnd),
        },
      })
    },
    onSkip: (b: FixedBlock) =>
      override.mutate(
        { lifePatternId: b.lifePatternId, targetDate: b.targetDate, skipped: true },
        { onSuccess: close }
      ),
    onReset: (b: FixedBlock) =>
      resetOverride.mutate({ lifePatternId: b.lifePatternId, targetDate: b.targetDate }, { onSuccess: close }),
  }

  // ── 드래그 앤 드롭 (명세 3-4) ──
  const onDrop = (source: DragSource, target: DropTarget) => {
    const p: Pending | null =
      source.kind === 'task'
        ? target.type === 'grid'
          ? { kind: 'task', taskId: source.task.taskId, date: target.date, start: target.start, end: target.end }
          : { kind: 'task', taskId: source.task.taskId, date: null, start: 0, end: 0 }
        : target.type === 'grid'
          ? { kind: 'fixed', key: fixedKey(source.block), date: target.date, start: target.start, end: target.end }
          : null
    if (!p) return
    setPending((list) => [...list, p])
    // 성공·실패 모두 TimeTable 을 다시 불러온 뒤(useTimetableMutation 의 onSettled) 임시 표시를 지워요
    const done = { onSettled: () => setPending((list) => list.filter((x) => x !== p)) }

    if (source.kind === 'task' && target.type === 'grid') {
      reschedule.mutate(
        {
          taskId: source.task.taskId,
          plannedStartAt: toDateTime(target.date, target.start),
          plannedEndAt: toDateTime(target.date, target.end),
        },
        done
      )
    } else if (source.kind === 'task') {
      unschedule.mutate(source.task.taskId, done)
    } else if (target.type === 'grid') {
      override.mutate(
        {
          lifePatternId: source.block.lifePatternId,
          targetDate: source.block.targetDate,
          startTime: minutesToTime(target.start),
          endTime: minutesToTime(target.end),
        },
        done
      )
    }
  }

  const submitEdit = (v: TimeValue) => {
    if (!editing) return
    const done = { onSuccess: () => setEditing(null) }
    if (editing.kind === 'actual') {
      completeWithActual.mutate(
        {
          taskId: editing.task.taskId,
          actualStartAt: toDateTime(v.date, v.start),
          actualEndAt: toDateTime(v.date, v.end),
        },
        done
      )
    } else if (editing.kind === 'task') {
      reschedule.mutate(
        {
          taskId: editing.task.taskId,
          plannedStartAt: toDateTime(v.date, v.start),
          plannedEndAt: toDateTime(v.date, v.end),
        },
        done
      )
    } else {
      override.mutate(
        {
          lifePatternId: editing.block.lifePatternId,
          targetDate: editing.block.targetDate,
          startTime: minutesToTime(v.start),
          endTime: minutesToTime(v.end),
        },
        done
      )
    }
  }

  const busyTask = toggleComplete.isPending || unlock.isPending || unschedule.isPending
  const busyFixed = override.isPending || resetOverride.isPending

  const overlays = (
    <>
      {/* 블록 상세 */}
      {opened?.kind === 'task' && (
        <Popover anchor={opened.anchor} onClose={close} label="Task 상세">
          <TaskDetail task={liveTask(opened.task)} busy={busyTask} actions={taskActions} />
        </Popover>
      )}
      {opened?.kind === 'fixed' && (
        <Popover anchor={opened.anchor} onClose={close} label="고정 시간 상세">
          <FixedDetail block={opened.block} busy={busyFixed} actions={fixedActions} />
        </Popover>
      )}

      {/* 시간 변경 */}
      {editing && (
        <TimeEditModal
          key={
            editing.kind === 'fixed'
              ? `f${fixedKey(editing.block)}`
              : `${editing.kind === 'actual' ? 'a' : 't'}${editing.task.taskId}`
          }
          title={
            editing.kind === 'actual'
              ? '실제로 한 시간'
              : editing.kind === 'task'
                ? '시간 변경'
                : `${formatMonthDay(editing.block.targetDate)} ${editing.block.title} 시간`
          }
          description={
            editing.kind === 'actual'
              ? '실제로 시작하고 끝낸 시각을 남기면 완료로 표시되고, 나의 패턴의 시작 지연이 더 정확해져요.'
              : editing.kind === 'task'
                ? '직접 정한 시간은 잠겨서 자동 배치가 옮기지 않아요. 다른 블록과 겹치면 그 블록이 비켜나요.'
                : '이날만 바뀌고, 다음 날부터는 기본 패턴 시간이에요.'
          }
          initial={editing.initial}
          dateEditable={editing.kind === 'task'}
          loading={reschedule.isPending || override.isPending || completeWithActual.isPending}
          onSubmit={submitEdit}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Task를 삭제할까요?"
        description={confirmDelete ? `"${confirmDelete.taskName}"을(를) 삭제해요. 되돌릴 수 없어요.` : undefined}
        confirmLabel="삭제"
        tone="danger"
        loading={deleteTask.isPending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() =>
          confirmDelete && deleteTask.mutate(confirmDelete.taskId, { onSettled: () => setConfirmDelete(null) })
        }
      />
    </>
  )

  return { days, selection, onSelectTask, onSelectFixed, onDrop, close, toggleComplete, overlays }
}
