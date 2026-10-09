'use client'

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Link2, X } from 'lucide-react'
import { Popover, rectOf, type AnchorRect } from '@/components/ui/Popover'
import {
  useCompleteWithActual,
  useDeletePatternOverride,
  useDeleteTask,
  useLifePatterns,
  usePatternOverride,
  usePatternScopedChange,
  useRescheduleBatch,
  useRescheduleTask,
  useRoutineScopedReschedule,
  type ChangeScope,
  useToggleComplete,
  useUnlockTask,
  useUnscheduleTask,
} from '../api'
import { applyPending, type Pending } from '../layout'
import {
  SNAP_MINUTES,
  WEEKDAY_LABEL,
  addDays,
  formatMinutes,
  formatMonthDay,
  minutesFrom,
  minutesToTime,
  nowKst,
  timeToMinutes,
  toDateTime,
  todayKst,
  weekdayIndex,
} from '../time'
import type { ActualActivity, FixedBlock, TimeBlockTask, TimetableDay } from '../types'
import { ActivityForm, draftOf, type ActivityDraft } from './ActivityForm'
import { CarryProposalBar } from './CarryProposalBar'
import { FixedDetail } from './FixedDetail'
import { ScopeChooser, scopeOptions } from './ScopeChooser'
import { TaskDetail } from './TaskDetail'
import { TimeEditModal, type TimeValue } from './TimeEditModal'
import { canDragTask, fixedKey, type Selection } from './TimeGrid'
import { groupMoves, type DragSource, type DropTarget } from './useGridDrag'

type Opened =
  | { kind: 'task'; task: TimeBlockTask; anchor: AnchorRect }
  | { kind: 'fixed'; block: FixedBlock; anchor: AnchorRect }
  /** 실제로 한 일 기록 · 수정 */
  | { kind: 'activity'; draft: ActivityDraft; anchor: AnchorRect }
  | null

type Editing =
  | { kind: 'fixed'; block: FixedBlock; initial: TimeValue }
  /** 실제로 한 시간 입력 후 완료 */
  | { kind: 'actual'; task: TimeBlockTask; initial: TimeValue }
  | null

/** 드래그 직후 "어디까지 바꿀까요?"를 묻는 중인 변경 (그동안 새 자리에 임시로 그려 둬요) */
type ScopeAsk =
  | { kind: 'routine'; task: TimeBlockTask; date: string; start: number; end: number; pending: Pending }
  | {
      kind: 'fixed'
      block: FixedBlock
      /** 끌어놓은 칸의 날짜 (start/end 는 이 날 0시 기준 분 — 수면은 음수·1440 이상일 수 있어요) */
      date: string
      start: number
      end: number
      pending: Pending
      /** 수면: 기상(아침 블록의 끝)을 바꿨는지 취침(밤 블록의 시작)을 바꿨는지 */
      edge?: 'wake' | 'bed'
    }

/** 묶음에 넣을 수 있는 Task: 시간이 정해져 있고 드래그로 옮길 수 있는 것 */
const groupable = (t: TimeBlockTask) => !!t.plannedStartAt && canDragTask(t)

/** 블록 날짜 (계획 시작일) */
const blockDay = (t: TimeBlockTask) => t.plannedStartAt?.slice(0, 10) ?? null

/**
 * t 와 앞뒤로 바로 이어진 Task 들 (사이 간격 10분 이하). 쪼개 둔 연속 작업을 한 번에 고르려고 써요.
 * 그날 블록을 시작 순으로 놓고 t 에서 위·아래로 이어지는 동안 모아요.
 */
function chainOf(t: TimeBlockTask, days: TimetableDay[]): TimeBlockTask[] {
  const date = blockDay(t)
  const day = days.find((d) => d.date === date)
  if (!day || !date || !groupable(t)) return [t]
  const range = (x: TimeBlockTask) => {
    const s = minutesFrom(date, x.plannedStartAt!)
    const e = x.plannedEndAt ? minutesFrom(date, x.plannedEndAt) : s + (x.plannedDurationMinutes ?? 30)
    return { s, e }
  }
  const list = day.tasks
    .filter((x) => groupable(x) && blockDay(x) === date)
    .map((x) => ({ x, ...range(x) }))
    .sort((a, b) => a.s - b.s)
  const i = list.findIndex((v) => v.x.taskId === t.taskId)
  if (i < 0) return [t]
  let lo = i
  let hi = i
  let end = list[i].e
  while (hi + 1 < list.length && list[hi + 1].s - end <= SNAP_MINUTES) {
    hi++
    end = Math.max(end, list[hi].e)
  }
  let start = list[i].s
  while (lo - 1 >= 0 && start - list[lo - 1].e <= SNAP_MINUTES) {
    lo--
    start = Math.min(start, list[lo].s)
  }
  return list.slice(lo, hi + 1).map((v) => v.x)
}

/** 루틴 Task 가 속한 날짜 (루틴 인스턴스 날짜) */
const routineDay = (t: TimeBlockTask) => t.date ?? t.plannedStartAt?.slice(0, 10) ?? null

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
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- 시간 미정 Task 의 기본 날짜는 이제 상세 창이 직접 정해요 (호출부 호환용으로 남김)
export function useTimetableInteractions(rawDays: TimetableDay[], fallbackDate: string) {
  const [opened, setOpened] = useState<Opened>(null)
  const [editing, setEditing] = useState<Editing>(null)
  // "삭제할까요?"를 띄운 Task (상세 창 안에서 확인해요)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  // 드래그로 옮긴 뒤 서버 응답을 기다리는 동안 새 위치에 그려 둘 블록들
  const [pending, setPending] = useState<Pending[]>([])
  const [ask, setAsk] = useState<ScopeAsk | null>(null)
  // 묶음 드래그로 같이 옮길 Task id (Shift·⌘·Ctrl+클릭, 또는 상세의 "이어진 N개 묶어 옮기기")
  const [group, setGroup] = useState<number[]>([])
  const today = todayKst()

  const toggleComplete = useToggleComplete()
  const deleteTask = useDeleteTask()
  const unlock = useUnlockTask()
  const unschedule = useUnscheduleTask()
  const reschedule = useRescheduleTask()
  const rescheduleBatch = useRescheduleBatch()
  const completeWithActual = useCompleteWithActual()
  const override = usePatternOverride()
  const routineScoped = useRoutineScopedReschedule()
  const patternScoped = usePatternScopedChange()
  const resetOverride = useDeletePatternOverride()
  // 자정을 넘기는 고정 시간 수정 때만 필요 → 그때만 불러와요
  const needsPatterns = editing?.kind === 'fixed' || opened?.kind === 'fixed'
  const patterns = useLifePatterns(needsPatterns)

  const days = useMemo(() => applyPending(rawDays, pending, fixedKey), [rawDays, pending])

  // 묶음 중 지금도 옮길 수 있는 Task 만 (완료했거나 시간 미정이 된 Task 는 빠져요)
  const groupIds = useMemo(() => {
    const live = new Set(
      days
        .flatMap((d) => d.tasks)
        .filter(groupable)
        .map((t) => t.taskId)
    )
    return new Set(group.filter((id) => live.has(id))) as ReadonlySet<number>
  }, [days, group])
  const clearGroup = () => setGroup([])

  // 22시 이월 제안 (아직 확인 안 한 것) — 오늘 이후, 시간순
  const carryProposals = useMemo(() => {
    const seen = new Set<number>()
    return days
      .flatMap((d) => [...d.tasks, ...d.unscheduledTasks])
      .filter((t) => {
        if (!t.carryPending || t.taskStatus !== 'TODO' || seen.has(t.taskId)) return false
        seen.add(t.taskId)
        return (t.plannedStartAt?.slice(0, 10) ?? t.date ?? today) >= today
      })
      .sort((a, b) =>
        (a.plannedStartAt ?? `${a.date ?? today}T99`).localeCompare(b.plannedStartAt ?? `${b.date ?? today}T99`)
      )
  }, [days, today])

  // 데이터가 새로 오면 팝오버 안의 Task 도 최신 값으로
  const liveTask = (t: TimeBlockTask) =>
    days.flatMap((d) => [...d.tasks, ...d.unscheduledTasks]).find((x) => x.taskId === t.taskId) ?? t

  const selection: Selection =
    opened?.kind === 'task'
      ? { kind: 'task', id: opened.task.taskId }
      : opened?.kind === 'fixed'
        ? { kind: 'fixed', key: fixedKey(opened.block) }
        : opened?.kind === 'activity' && opened.draft.activity
          ? { kind: 'activity', id: opened.draft.activity.activityId }
          : null

  const close = () => {
    setOpened(null)
    setConfirmDeleteId(null)
  }

  // ⚠️ e.currentTarget 은 이벤트 처리 중에만 값이 있어요 → setState 콜백 밖에서 먼저 위치를 읽어 둬요
  const onSelectTask = (task: TimeBlockTask, e: MouseEvent<HTMLElement>) => {
    // Shift · ⌘ · Ctrl + 클릭 → 묶음에 넣기/빼기 (상세 창은 열지 않아요)
    if ((e.shiftKey || e.metaKey || e.ctrlKey) && groupable(task)) {
      e.preventDefault()
      const date = blockDay(task)
      const all = days.flatMap((d) => d.tasks)
      setGroup((g) => {
        // 묶음은 같은 날 Task 끼리만 — 다른 날 Task 를 고르면 새로 시작해요
        const sameDay = g.filter((id) => blockDay(all.find((x) => x.taskId === id) ?? task) === date)
        // 처음 묶을 때 상세 창이 열려 있던 같은 날 Task 도 같이 넣어요
        const seed =
          !sameDay.length && opened?.kind === 'task' && opened.task.taskId !== task.taskId
            ? [opened.task].filter((o) => groupable(o) && blockDay(o) === date).map((o) => o.taskId)
            : []
        const base = [...seed, ...sameDay]
        return base.includes(task.taskId) ? base.filter((id) => id !== task.taskId) : [...base, task.taskId]
      })
      setOpened(null)
      setConfirmDeleteId(null)
      return
    }
    const anchor = rectOf(e.currentTarget)
    setConfirmDeleteId(null)
    setOpened((o) => (o?.kind === 'task' && o.task.taskId === task.taskId ? null : { kind: 'task', task, anchor }))
  }
  const onSelectFixed = (block: FixedBlock, e: MouseEvent<HTMLElement>) => {
    const anchor = rectOf(e.currentTarget)
    setOpened((o) =>
      o?.kind === 'fixed' && fixedKey(o.block) === fixedKey(block) ? null : { kind: 'fixed', block, anchor }
    )
  }

  // ── 실제로 한 일 ──
  const onSelectActivity = (a: ActualActivity, e: MouseEvent<HTMLElement>) => {
    const anchor = rectOf(e.currentTarget)
    setConfirmDeleteId(null)
    setOpened((o) =>
      o?.kind === 'activity' && o.draft.activity?.activityId === a.activityId
        ? null
        : { kind: 'activity', draft: draftOf(a), anchor }
    )
  }
  /** 새 기록 열기 (끝은 지금을 넘지 않게) */
  const openActivity = (draft: ActivityDraft, anchor: AnchorRect) => {
    const now = nowKst()
    const nowMin = draft.date === now.date ? now.minutes : Infinity
    const end = Math.min(draft.end, nowMin)
    const start = Math.min(draft.start, end - 10)
    setConfirmDeleteId(null)
    setOpened({ kind: 'activity', draft: { ...draft, start: Math.max(start, 0), end }, anchor })
  }
  /** 빈 칸 클릭 → 그 시각부터 1시간 */
  const onEmptyClick = (date: string, minutes: number, e: MouseEvent<HTMLElement>) =>
    openActivity(
      { date, start: minutes, end: minutes + 60 },
      { top: e.clientY, bottom: e.clientY, left: e.clientX, right: e.clientX }
    )

  // ── Task 작업 ──
  const taskActions = {
    // 계획했던 시간에 다른 일을 했어요 → 그 시간으로 실제 기록 (계획 Task 연결)
    onRecordInstead: (t: TimeBlockTask) => {
      if (!t.plannedStartAt) return
      const day = t.plannedStartAt.slice(0, 10)
      const s = minutesFrom(day, t.plannedStartAt)
      const e = t.plannedEndAt ? minutesFrom(day, t.plannedEndAt) : s + (t.plannedDurationMinutes ?? 30)
      const anchor = opened?.anchor ?? { top: 120, bottom: 120, left: 120, right: 120 }
      openActivity({ date: day, start: s, end: e, replaced: { id: t.taskId, name: t.taskName } }, anchor)
    },
    onToggleComplete: (t: TimeBlockTask) => toggleComplete.mutate(t, { onSuccess: close }),
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
    // 삭제는 바로 지우지 않고 상세 창 안에 "삭제할까요?"를 띄워요 (Delete 키와 같음)
    onDelete: (t: TimeBlockTask) => setConfirmDeleteId(t.taskId),
    chainSize: (t: TimeBlockTask) => chainOf(t, days).length,
    onSelectChain: (t: TimeBlockTask) => {
      setGroup(chainOf(t, days).map((x) => x.taskId))
      close()
    },
  }

  // ── Delete / Backspace 키로 삭제 ──
  // 열린 상세 창의 Task, 또는 키보드로 고른(포커스된) 블록이 대상이에요. 입력칸에서 누른 건 무시.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const el = e.target instanceof HTMLElement ? e.target : null
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) return

      const all = days.flatMap((d) => [...d.tasks, ...d.unscheduledTasks])
      let task: TimeBlockTask | undefined
      if (opened?.kind === 'task') {
        task = all.find((x) => x.taskId === opened.task.taskId) ?? opened.task
      } else {
        const block = el?.closest<HTMLElement>('[data-task-id]')
        const id = Number(block?.dataset.taskId)
        task = all.find((x) => x.taskId === id)
        // 포커스만 된 블록이면 상세 창을 열고 그 안에서 확인해요
        if (task && block) setOpened({ kind: 'task', task, anchor: rectOf(block) })
      }
      if (!task || task.sourceType === 'MISSION') return
      e.preventDefault()
      setConfirmDeleteId(task.taskId)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [opened, days])

  const confirmDeleteTask = () => {
    if (confirmDeleteId === null) return
    deleteTask.mutate(confirmDeleteId, { onSuccess: close })
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

  // ── 범위를 골라 실제로 저장 (이날만 / 이번 주 / 앞으로) ──
  const saveRoutine = (
    task: TimeBlockTask,
    date: string,
    start: number,
    end: number,
    scope: ChangeScope,
    opts: object
  ) =>
    routineScoped.mutate(
      { taskId: task.taskId, plannedStartAt: toDateTime(date, start), plannedEndAt: toDateTime(date, end), scope },
      opts
    )
  /**
   * @param date start/end 의 기준 날짜 (끌어놓은 칸). 블록 소속 날짜(targetDate)와 시작 날짜가 다르면
   *             startDayOffset 으로 알려줘요 — 예: 토요일 소속 수면(00:00)을 금요일 밤 23:30 취침으로 → -1
   */
  const saveFixed = (block: FixedBlock, date: string, start: number, end: number, scope: ChangeScope, opts: object) => {
    const startDate = addDays(date, Math.floor(start / 1440))
    const startDayOffset = Math.round(minutesFrom(block.targetDate, `${startDate}T00:00:00`) / 1440)
    patternScoped.mutate(
      {
        lifePatternId: block.lifePatternId,
        targetDate: block.targetDate,
        startTime: minutesToTime(start),
        endTime: minutesToTime(end),
        scope,
        startDayOffset,
      },
      opts
    )
  }

  const dropPending = (p: Pending) => setPending((list) => list.filter((x) => x !== p))

  const chooseScope = (scope: ChangeScope) => {
    if (!ask) return
    // 성공·실패 모두 TimeTable 을 다시 불러온 뒤 임시 표시를 지워요
    const opts = { onSettled: () => dropPending(ask.pending) }
    if (ask.kind === 'routine') saveRoutine(ask.task, ask.date, ask.start, ask.end, scope, opts)
    else saveFixed(ask.block, ask.date, ask.start, ask.end, scope, opts)
    setAsk(null)
  }
  const cancelAsk = () => {
    if (ask) dropPending(ask.pending)
    setAsk(null)
  }

  // 범위를 고르지 않고 떠나면(화면 이동 등) "이날만"으로 저장해요
  const askRef = useRef<{ ask: ScopeAsk | null; save: (scope: ChangeScope) => void }>({ ask: null, save: () => {} })
  useEffect(() => {
    askRef.current = { ask, save: chooseScope }
  })
  useEffect(
    () => () => {
      if (askRef.current.ask) askRef.current.save('DAY')
    },
    []
  )

  // 묶음: Esc 로 풀기 (상세 창·범위 고르기가 떠 있을 땐 그쪽이 Esc 를 받아요)
  useEffect(() => {
    if (!group.length) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !opened && !ask && !editing) setGroup([])
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [group.length, opened, ask, editing])

  // ── 드래그 앤 드롭 (명세 3-4) ──
  const onDrop = (source: DragSource, target: DropTarget) => {
    // 범위를 고르지 않고 다음 드래그를 하면 앞의 변경은 "이날만"으로 저장해요
    if (ask) chooseScope('DAY')

    // 묶음 드래그: 끈 만큼 묶음 전체를 같이 옮기고 한 번에 저장 (루틴도 이날만 바뀌어요)
    if (source.kind === 'task' && source.group?.length && target.type === 'grid') {
      const moves = groupMoves(source, target)
      const ps: Pending[] = moves.map((m) => ({
        kind: 'task',
        taskId: m.task.taskId,
        date: m.date,
        start: m.start,
        end: m.end,
      }))
      setPending((list) => [...list, ...ps])
      rescheduleBatch.mutate(
        {
          items: moves.map((m) => ({
            taskId: m.task.taskId,
            plannedStartAt: toDateTime(m.date, m.start),
            plannedEndAt: toDateTime(m.date, m.end),
          })),
        },
        { onSettled: () => setPending((list) => list.filter((x) => !ps.includes(x))) }
      )
      return
    }
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

    // 루틴을 같은 날 안에서 옮겼거나, 고정 시간을 옮겼으면 → 범위를 물어봐요
    if (
      source.kind === 'task' &&
      target.type === 'grid' &&
      source.task.sourceType === 'ROUTINE' &&
      routineDay(source.task) === target.date
    ) {
      setAsk({
        kind: 'routine',
        task: source.task,
        date: target.date,
        start: target.start,
        end: target.end,
        pending: p,
      })
      return
    }
    if (source.kind === 'fixed' && target.type === 'grid') {
      setAsk({
        kind: 'fixed',
        block: source.block,
        date: target.date,
        start: target.start,
        end: target.end,
        pending: p,
        edge: source.block.patternType === 'SLEEP' ? (target.start !== source.start ? 'bed' : 'wake') : undefined,
      })
      return
    }

    const done = { onSettled: () => dropPending(p) }
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
    }
  }

  const submitEdit = (v: TimeValue, scope: ChangeScope) => {
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
    } else {
      saveFixed(editing.block, v.date, v.start, v.end, scope, done)
    }
  }

  const busyTask = toggleComplete.isPending || unlock.isPending || unschedule.isPending
  const busyFixed = override.isPending || resetOverride.isPending || patternScoped.isPending

  const overlays = (
    <>
      {/* 블록 상세 */}
      {opened?.kind === 'task' && (
        <Popover anchor={opened.anchor} onClose={close} label="Task 상세" width={360}>
          <TaskDetail
            key={opened.task.taskId}
            task={liveTask(opened.task)}
            busy={busyTask}
            actions={taskActions}
            confirmingDelete={confirmDeleteId === opened.task.taskId}
            deleting={deleteTask.isPending}
            onConfirmDelete={confirmDeleteTask}
            onCancelDelete={() => setConfirmDeleteId(null)}
          />
        </Popover>
      )}
      {opened?.kind === 'activity' && (
        <Popover anchor={opened.anchor} onClose={close} label="실제로 한 일" width={340}>
          <ActivityForm
            key={`${opened.draft.activity?.activityId ?? 'new'}-${opened.draft.date}-${opened.draft.start}`}
            draft={opened.draft}
            onDone={close}
          />
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
          key={editing.kind === 'fixed' ? `f${fixedKey(editing.block)}` : `a${editing.task.taskId}`}
          title={
            editing.kind === 'actual'
              ? '실제로 한 시간'
              : `${formatMonthDay(editing.block.targetDate)} ${editing.block.title} 시간`
          }
          description={
            editing.kind === 'actual'
              ? '실제로 시작하고 끝낸 시각을 남기면 완료로 표시되고, 나의 패턴의 시작 지연이 더 정확해져요.'
              : '적용 범위를 골라 주세요. 이날만 바꾸면 다음 날부터는 기본 시간이에요.'
          }
          scope={editing.kind === 'fixed' ? { kind: 'fixed', today } : undefined}
          initial={editing.initial}
          dateEditable={false}
          loading={
            reschedule.isPending || patternScoped.isPending || routineScoped.isPending || completeWithActual.isPending
          }
          onSubmit={submitEdit}
          onClose={() => setEditing(null)}
        />
      )}

      {/* 드래그 후 범위 고르기 */}
      {ask && (
        <ScopeChooser
          title={
            ask.kind === 'routine'
              ? `'${ask.task.taskName}' → ${formatMinutes(ask.start)}–${formatMinutes(ask.end)}`
              : ask.edge
                ? ask.edge === 'wake'
                  ? `☀️ 기상 ${minutesToTime(minutesFrom(ask.date, ask.block.end))} → ${minutesToTime(ask.end)}`
                  : `🌙 취침 ${minutesToTime(minutesFrom(ask.date, ask.block.start))} → ${minutesToTime(ask.start)}`
                : `${ask.block.emoji ? `${ask.block.emoji} ` : ''}${ask.block.title} → ${formatMinutes(ask.start)}–${formatMinutes(ask.end)}`
          }
          options={scopeOptions({
            kind: ask.kind,
            isToday: ask.date === today,
            crossesMidnight: ask.end >= 1440,
            // 고정 시간: "앞으로 ○요일마다" — 수면은 끌어놓은 칸 기준 "토요일 아침/밤"
            weekdayLabel:
              ask.kind === 'fixed'
                ? `${WEEKDAY_LABEL[weekdayIndex(ask.date)]}요일${ask.edge ? (ask.edge === 'wake' ? ' 아침' : ' 밤') : ''}`
                : undefined,
          })}
          onChoose={chooseScope}
          onCancel={cancelAsk}
          onDismiss={() => chooseScope('DAY')}
        />
      )}

      {/* 22시 이월 제안 — 다른 안내 바가 없을 때만 (범위 고르기·묶음이 먼저) */}
      {!ask && groupIds.size === 0 && <CarryProposalBar tasks={carryProposals} today={today} />}

      {/* 묶음 드래그 안내 */}
      {groupIds.size > 0 && !ask && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div
            role="status"
            className="bg-ink pointer-events-auto flex max-w-[560px] items-center gap-2 rounded-full py-2 pr-2 pl-4 text-[13px] text-white shadow-[0_8px_24px_rgb(17_17_17/0.25)]"
          >
            <Link2 className="size-4 shrink-0" />
            <span className="min-w-0">
              {groupIds.size > 1 ? (
                <>
                  <b>{groupIds.size}개 묶음</b> · 하나를 끌면 같이 움직여요
                </>
              ) : (
                <>
                  <b>1개 선택</b> · Shift(⌘)+클릭으로 더 묶어요
                </>
              )}
            </span>
            <button
              type="button"
              onClick={clearGroup}
              className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold hover:bg-white/15"
            >
              <X className="size-3.5" />
              묶음 풀기
            </button>
          </div>
        </div>
      )}
    </>
  )

  return {
    days,
    selection,
    onSelectTask,
    onSelectFixed,
    onSelectActivity,
    onEmptyClick,
    openActivity,
    onDrop,
    close,
    toggleComplete,
    overlays,
    /** 묶음 드래그로 같이 옮길 Task (TimeGrid groupIds 로 넘겨요) */
    groupIds,
  }
}
