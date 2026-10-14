'use client'

import { Fragment, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type RefObject } from 'react'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CircleDashed,
  Flag,
  ListTodo,
  Loader,
  MessageSquareText,
  Pencil,
  PencilLine,
  PenLine,
  Plus,
  Share2,
  Trash2,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import type { GoalCategory } from '@/features/goal/api'
import { inlineInput } from '@/features/goal/edit/inline'
import { Section } from '@/features/goal/ui/sections'
import { GoalNotes } from '@/features/goal/ui/GoalHeader'
import { RoutinesSection } from '@/features/goal/ui/RoutinesSection'
import { RecordJournal } from '@/features/record/ui/RecordJournal'
import { RecordQuickLog } from '@/features/record/ui/RecordQuickLog'
import { todayKst, weekdayIndex, WEEKDAY_LABEL } from '@/features/timetable/time'
import {
  useCreateWorkRetro,
  useCreateWorkTask,
  useCreateWorkTasks,
  useCreateWorkTopic,
  useDeleteWorkRetro,
  useDeleteWorkTopic,
  useMoveWorkTask,
  useUpdateWorkTopic,
  useWorkBoard,
  type TopicStatus,
  type WorkBoard,
  type WorkColumn,
  type WorkTask,
  type WorkTopic,
} from '../api'
import { COLUMN_LABEL, dayLabel, dueLabel, fullDate, goalDDay } from '../format'
import { WorkShareModal } from './WorkShareModal'
import { WorkTaskModal } from './WorkTaskModal'

/** 주제 필터: 전체 · 주제 id · 주제 없음 */
type TopicFilter = 'ALL' | 'NONE' | number

const matchTopic = (t: WorkTask, f: TopicFilter) =>
  f === 'ALL' ? true : f === 'NONE' ? t.topicId === null : t.topicId === f

// ─── 1. 다음 마감 · 진행 요약 ────────────────────────────────────

function Meter({ label, value, right }: { label: string; value: number | null; right?: string }) {
  if (value === null) return null
  return (
    <div>
      <div className="mb-1 flex justify-between text-[12px] text-white/75">
        <span>{label}</span>
        <span className="font-semibold text-white tabular-nums">{right ?? `${value}%`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
      </div>
    </div>
  )
}

/** 마감까지 속도 — 하루 1개 이상이면 "하루 2개씩", 적으면 "3일에 1개씩" */
function paceLabel(perDay: number) {
  if (perDay >= 1) return `하루 ${String(Math.round(perDay * 10) / 10).replace(/\.0$/, '')}개씩`
  return `${Math.max(Math.round(1 / perDay), 2)}일에 1개씩`
}

/** 주제 마감 표시 — "D-3" · "오늘 마감" · "2일 지남" */
function topicDueLabel(dDay: number | null) {
  if (dDay == null) return null
  if (dDay === 0) return '오늘 마감'
  return dDay > 0 ? `D-${dDay}` : `${-dDay}일 지남`
}

/** "~10/16(금)" */
const shortDate = (ymd: string) =>
  `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}(${WEEKDAY_LABEL[weekdayIndex(ymd)]})`

function SummaryHero({ board, onShare }: { board: WorkBoard; onShare: () => void }) {
  const s = board.summary
  const next = s.nextTopic
  const overdueTopics = board.timeline.filter((t) => t.status === 'OVERDUE').length
  const topicPercent = s.topicsTotal ? Math.round((s.topicsDone / s.topicsTotal) * 100) : null

  return (
    <section className="bg-inverse rounded-[24px] p-6 text-white sm:p-7">
      <div className="flex flex-wrap items-start gap-x-8 gap-y-5">
        {/* 다음 마감 */}
        <div className="max-w-full min-w-[200px]">
          <p className="flex items-center gap-1.5 text-[13px] text-white/70">
            <Flag className="size-4" />
            다음 마감
          </p>
          {next ? (
            <>
              <p className="mt-1.5 truncate text-[17px] font-bold">
                {next.emoji ? `${next.emoji} ` : ''}
                {next.name}
              </p>
              <p
                className={cn(
                  'mt-1 text-[44px] leading-none font-bold tracking-tight',
                  next.dDay! < 0 && 'text-[#FCA5A5]'
                )}
              >
                {goalDDay(next.dDay)}
              </p>
              <p className="mt-1.5 text-[14px] text-white/80">
                {fullDate(next.dueDate!)}까지
                {next.remaining > 0 && ` · 남은 ${next.remaining}개`}
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-[26px] leading-tight font-bold">
                {s.topicsTotal === 0
                  ? '아직 주제가 없어요'
                  : s.topicsDone === s.topicsTotal
                    ? '모든 주제를 끝냈어요'
                    : '마감 정한 주제가 없어요'}
              </p>
              <p className="mt-1.5 text-[13px] text-white/70">
                {s.topicsTotal === 0
                  ? '로드맵에 주제를 만들고 마감을 정해 보세요'
                  : s.topicsDone === s.topicsTotal
                    ? '수고했어요! 다음 주제를 이어서 만들어도 돼요'
                    : '주제에 마감을 정하면 하루에 몇 개씩 해야 하는지 알려드려요'}
              </p>
            </>
          )}
        </div>

        {/* 진행 */}
        <div className="min-w-[220px] flex-1">
          <p className="text-[13px] text-white/70">진행</p>
          <p className="mt-1 text-[32px] leading-none font-bold">
            {s.done}
            <span className="text-[18px] font-semibold text-white/60"> / {s.total}개 완료</span>
          </p>
          <div className="mt-4 space-y-2.5">
            <Meter label="Task 완료" value={s.progressPercent} />
            <Meter label="끝낸 주제" value={topicPercent} right={`${s.topicsDone} / ${s.topicsTotal}`} />
          </div>
        </div>

        <Button variant="secondary" size="sm" onClick={onShare} className="ml-auto">
          <Share2 className="size-4" />
          공유
        </Button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-[13px]">
        <Pill>남은 Task {s.remaining}개</Pill>
        {s.inProgress > 0 && <Pill>진행 중 {s.inProgress}개</Pill>}
        {next?.remainingPerDay != null && next.remainingPerDay > 0 && next.dDay! >= 0 && (
          <Pill>
            {next.name} 마감까지 {paceLabel(next.remainingPerDay)}
          </Pill>
        )}
        {overdueTopics > 0 && <Pill tone="danger">마감 지난 주제 {overdueTopics}개</Pill>}
        {s.overdue > 0 && <Pill tone="danger">마감 지난 Task {s.overdue}개</Pill>}
        {s.dueThisWeek > 0 && <Pill tone="warning">이번 주 마감 {s.dueThisWeek}개</Pill>}
      </div>
    </section>
  )
}

function Pill({ children, tone }: { children: React.ReactNode; tone?: 'danger' | 'warning' }) {
  return (
    <span
      className={cn(
        'rounded-full px-3 py-1 font-semibold',
        tone === 'danger'
          ? 'bg-[#EF4444]/25 text-[#FECACA]'
          : tone === 'warning'
            ? 'bg-[#F59E0B]/25 text-[#FDE68A]'
            : 'bg-white/12 text-white/90'
      )}
    >
      {children}
    </span>
  )
}

// ─── 1-2. 로드맵 (주제를 마감 순서대로 세로 선 위에) ─────────────────

const NODE_CLASS: Record<TopicStatus, string> = {
  DONE: 'border-brand bg-brand text-white',
  NEXT: 'border-brand bg-surface text-transparent ring-4 ring-brand/15',
  OVERDUE: 'border-danger bg-danger-soft text-danger',
  UPCOMING: 'border-line-strong bg-surface text-transparent',
  NO_DUE: 'border-line-strong border-dashed bg-surface text-transparent',
}

function TopicEditor({ goalId, topic, onDone }: { goalId: number; topic: WorkTopic; onDone: () => void }) {
  const update = useUpdateWorkTopic(goalId)
  const remove = useDeleteWorkTopic(goalId)
  const [name, setName] = useState(topic.name)
  const [due, setDue] = useState(topic.dueDate ?? '')
  const id = topic.topicId!
  const save = () => {
    const v = name.trim()
    if (!v) return
    update.mutate(
      { topicId: id, name: v, ...(due ? { dueDate: due } : topic.dueDate ? { clearDueDate: true } : {}) },
      { onSuccess: onDone }
    )
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
      onKeyDown={(e) => e.key === 'Escape' && onDone()}
      className="border-line bg-subtle/60 mt-2 space-y-2 rounded-xl border p-3"
    >
      <input
        autoFocus
        value={name}
        maxLength={30}
        onChange={(e) => setName(e.target.value)}
        aria-label="주제 이름"
        className={`${inlineInput} h-9`}
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          aria-label="주제 마감"
          className="border-line-strong bg-surface h-8 rounded-lg border px-2 text-[13px]"
        />
        {due && (
          <button
            type="button"
            onClick={() => setDue('')}
            className="text-ink-3 hover:text-ink text-[12px] font-semibold"
          >
            마감 없이
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => remove.mutate(id, { onSuccess: onDone })}
          className="text-ink-3 hover:text-danger flex items-center gap-0.5 text-[12px] font-semibold"
        >
          <Trash2 className="size-3" />
          주제 지우기
        </button>
        <button type="button" onClick={onDone} className="text-ink-3 hover:text-ink ml-auto text-[12px] font-semibold">
          취소
        </button>
        <Button size="sm" type="submit" loading={update.isPending} disabled={!name.trim()}>
          저장
        </Button>
      </div>
    </form>
  )
}

/** 로드맵 주제 아래 할 일 한 줄 — 체크하면 완료, 이름을 누르면 자세히 */
function RoadmapTask({
  task,
  today,
  onOpen,
  onToggle,
}: {
  task: WorkTask
  today: string
  onOpen: () => void
  onToggle: () => void
}) {
  const done = task.status === 'DONE'
  return (
    <li className="flex items-start gap-2.5 py-1">
      <span className="pt-px">
        <CheckButton task={task} onToggle={onToggle} small />
      </span>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className={cn('block text-[14px] leading-5', done ? 'text-ink-3 line-through' : 'font-medium')}>
          {task.emoji ? `${task.emoji} ` : ''}
          {task.taskName}
        </span>
        {!done && <TaskMeta task={task} today={today} showTopic={false} />}
      </button>
    </li>
  )
}

/** 주제에 딸린 할 일 — 남은 일은 펼치고, 끝낸 일은 접어 둬요 */
function TopicTasks({
  open,
  done,
  today,
  collapsed,
  onOpen,
  onToggle,
  onAdd,
}: {
  open: WorkTask[]
  done: WorkTask[]
  today: string
  /** 끝난 주제는 할 일을 접어서 시작 */
  collapsed: boolean
  onOpen: (t: WorkTask) => void
  onToggle: (t: WorkTask) => void
  onAdd: () => void
}) {
  const [showOpen, setShowOpen] = useState(!collapsed)
  const [showDone, setShowDone] = useState(false)
  return (
    <div className="mt-2">
      {open.length > 0 &&
        (showOpen ? (
          <ul className="border-line bg-subtle/40 rounded-xl border px-3 py-1.5">
            {open.map((t) => (
              <RoadmapTask
                key={t.taskId}
                task={t}
                today={today}
                onOpen={() => onOpen(t)}
                onToggle={() => onToggle(t)}
              />
            ))}
          </ul>
        ) : (
          <button
            type="button"
            onClick={() => setShowOpen(true)}
            className="text-ink-3 hover:text-ink text-[12px] font-semibold"
          >
            남은 할 일 {open.length}개 보기
          </button>
        ))}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={onAdd}
          className="text-ink-3 hover:text-brand flex items-center gap-0.5 text-[12px] font-semibold"
        >
          <Plus className="size-3.5" />할 일
        </button>
        {done.length > 0 && (
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            aria-expanded={showDone}
            className="text-success flex items-center gap-0.5 text-[12px] font-semibold"
          >
            끝낸 일 {done.length}
            <ChevronDown className={cn('size-3.5 transition-transform', showDone && 'rotate-180')} />
          </button>
        )}
      </div>
      {showDone && done.length > 0 && (
        <ul className="mt-1">
          {done.map((t) => (
            <RoadmapTask key={t.taskId} task={t} today={today} onOpen={() => onOpen(t)} onToggle={() => onToggle(t)} />
          ))}
        </ul>
      )}
    </div>
  )
}

function RoadmapItem({
  goalId,
  topic: t,
  selected,
  onSelect,
  children,
}: {
  goalId: number
  topic: WorkTopic
  selected: boolean
  onSelect: () => void
  /** 주제 아래 할 일 목록 (로드맵 점과 점 사이) */
  children?: React.ReactNode
}) {
  const update = useUpdateWorkTopic(goalId)
  const [editing, setEditing] = useState(false)
  const done = t.status === 'DONE'
  // Task 를 모두 끝내서 "끝"인 주제는 되돌릴 게 없어요 (직접 끝냈다고 표시한 것만 다시 열기)
  const autoDone = done && !t.completed
  const due = done ? null : topicDueLabel(t.dDay)

  return (
    <li className="relative flex gap-3 pb-5">
      {/* 세로 선 */}
      <span aria-hidden className="bg-line absolute top-7 bottom-0 left-[13px] w-0.5" />
      <button
        type="button"
        disabled={autoDone || update.isPending}
        onClick={() => update.mutate({ topicId: t.topicId!, completed: !t.completed })}
        aria-pressed={done}
        aria-label={
          autoDone ? `${t.name}: Task를 모두 끝냈어요` : `${t.name} ${t.completed ? '다시 열기' : '끝냈어요'}`
        }
        title={autoDone ? 'Task를 모두 끝내서 끝난 주제예요' : t.completed ? '다시 열기' : '끝냈어요로 표시'}
        className={cn(
          'relative z-[1] grid size-7 shrink-0 place-items-center rounded-full border-2 transition-colors',
          NODE_CLASS[t.status],
          !done && 'hover:border-brand hover:text-brand/60'
        )}
      >
        {t.status === 'OVERDUE' ? (
          <AlertTriangle className="size-3.5" strokeWidth={2.5} />
        ) : (
          <Check className="size-3.5" strokeWidth={3} />
        )}
      </button>

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            className={cn(
              'min-w-0 flex-1 text-left text-[15px] leading-snug font-bold',
              done && 'text-ink-3 line-through decoration-1',
              selected && 'text-brand'
            )}
          >
            {t.emoji ? `${t.emoji} ` : ''}
            {t.name}
          </button>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-label={`${t.name} 고치기`}
            className="text-ink-4 hover:text-ink shrink-0 p-0.5"
          >
            <Pencil className="size-3.5" />
          </button>
        </div>
        <p className="text-ink-3 mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px]">
          {t.dueDate ? <span>~{shortDate(t.dueDate)}</span> : <span>마감 없음</span>}
          {due && (
            <span
              className={cn(
                'font-semibold',
                t.status === 'OVERDUE'
                  ? 'text-danger'
                  : t.status === 'NEXT'
                    ? 'text-brand'
                    : t.dDay! <= 3 && 'text-warning-ink'
              )}
            >
              {due}
            </span>
          )}
          {done && <span className="text-success font-semibold">끝</span>}
          {!done && t.total > 0 && <span>남은 {t.remaining}개</span>}
          {t.status === 'NEXT' && t.remainingPerDay != null && t.remainingPerDay > 0 && (
            <span>{paceLabel(t.remainingPerDay)}</span>
          )}
        </p>
        {t.total > 0 && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="bg-subtle h-1.5 flex-1 overflow-hidden rounded-full">
              <div
                className={cn('h-full rounded-full', done ? 'bg-success' : 'bg-brand')}
                style={{ width: `${t.progressPercent ?? 0}%` }}
              />
            </div>
            <span className="text-ink-3 text-[11px] tabular-nums">
              {t.done}/{t.total}
            </span>
          </div>
        )}
        {editing && <TopicEditor goalId={goalId} topic={t} onDone={() => setEditing(false)} />}
        {children}
      </div>
    </li>
  )
}

/** "주제 없음" 할 일 — 로드맵 맨 끝(🏁 앞)에 점선 점으로 */
function NoTopicItem({ children, count }: { children: React.ReactNode; count: number }) {
  return (
    <li className="relative flex gap-3 pb-5">
      <span aria-hidden className="bg-line absolute top-7 bottom-0 left-[13px] w-0.5" />
      <span className="border-line-strong bg-surface relative z-[1] size-7 shrink-0 rounded-full border-2 border-dotted" />
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-ink-2 text-[15px] leading-snug font-bold">주제 없음</p>
        <p className="text-ink-3 mt-0.5 text-[12px]">아직 주제를 정하지 않은 할 일 {count}개</p>
        {children}
      </div>
    </li>
  )
}

function TodayMarker() {
  return (
    <li className="relative flex items-center gap-3 pb-5" aria-label="오늘">
      <span aria-hidden className="bg-line absolute top-3 bottom-0 left-[13px] w-0.5" />
      <span className="relative z-[1] grid w-7 shrink-0 place-items-center">
        <span className="bg-ink size-2.5 rounded-full" />
      </span>
      <span className="text-ink text-[12px] font-bold">오늘</span>
      <span className="bg-line h-px flex-1" />
    </li>
  )
}

function AddTopic({ goalId, onCreated }: { goalId: number; onCreated: (id: number) => void }) {
  const create = useCreateWorkTopic(goalId)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [due, setDue] = useState('')
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-ink-3 hover:text-ink border-line-strong mt-1 flex h-9 w-full items-center justify-center gap-1 rounded-xl border border-dashed text-[13px] font-semibold"
      >
        <Plus className="size-3.5" />
        주제 추가
      </button>
    )
  }
  const submit = () => {
    const v = name.trim()
    if (!v) return
    create.mutate(
      { name: v, dueDate: due || null },
      {
        onSuccess: (t) => {
          setName('')
          setDue('')
          setOpen(false)
          onCreated(t.topicId)
        },
      }
    )
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      className="border-brand/40 mt-1 space-y-2 rounded-xl border p-3"
    >
      <input
        autoFocus
        value={name}
        maxLength={30}
        onChange={(e) => setName(e.target.value)}
        placeholder="예: 이력서 제출"
        aria-label="새 주제 이름"
        className={`${inlineInput} h-9`}
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-ink-3 flex items-center gap-1 text-[12px]">
          마감
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="border-line-strong bg-surface text-ink h-8 rounded-lg border px-2 text-[13px]"
          />
        </label>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="취소"
          className="text-ink-3 hover:text-ink ml-auto p-1"
        >
          <X className="size-4" />
        </button>
        <Button size="sm" type="submit" loading={create.isPending} disabled={!name.trim()}>
          만들기
        </Button>
      </div>
    </form>
  )
}

/**
 * 로드맵 — 주제를 마감 순서대로 세로 선 위에 놓아요. 끝난 주제는 채운 점, 다음 마감은 강조,
 * 마감 지난 주제는 빨간 점, 마감 없는 주제는 점선. 점을 누르면 "끝냈어요", 이름을 누르면 보드가 그 주제만 보여줘요.
 */
function Roadmap({
  goalId,
  board,
  filter,
  onFilter,
  onOpen,
  onToggle,
  onAdd,
}: {
  goalId: number
  board: WorkBoard
  filter: TopicFilter
  onFilter: (f: TopicFilter) => void
  onOpen: (t: WorkTask) => void
  onToggle: (t: WorkTask) => void
  /** 이 주제(null = 주제 없음)에 할 일 적기 — 오른쪽 "적기" 패널로 */
  onAdd: (topicId: number | null) => void
}) {
  const { timeline, today, summary: s } = board
  // 주제별 할 일 — 진행 중을 위로, 그다음 마감 · 하는 날 순 (보드 칸 순서 그대로)
  const byTopic = useMemo(() => {
    const open = new Map<number | null, WorkTask[]>()
    const done = new Map<number | null, WorkTask[]>()
    const push = (m: Map<number | null, WorkTask[]>, t: WorkTask) => m.set(t.topicId, [...(m.get(t.topicId) ?? []), t])
    board.board.inProgress.forEach((t) => push(open, t))
    board.board.notStarted.forEach((t) => push(open, t))
    board.board.done.forEach((t) => push(done, t))
    return { open, done }
  }, [board])
  const noTopicOpen = byTopic.open.get(null) ?? []
  // "오늘" 표시는 마감이 오늘 이후인 첫 주제 앞 (마감 없는 주제는 맨 뒤라 그 앞)
  const todayAt = (() => {
    const i = timeline.findIndex((t) => t.dueDate === null || t.dueDate >= today)
    return i === -1 ? timeline.length : i
  })()

  return (
    <Section title="로드맵" aside={s.topicsTotal ? `주제 ${s.topicsDone} / ${s.topicsTotal} 끝` : undefined}>
      {timeline.length === 0 ? (
        <p className="text-ink-3 mb-3 text-sm">
          포트폴리오 · 이력서 제출처럼 큰 단계를 주제로 만들고, 주제마다 마감을 정해 보세요.
        </p>
      ) : (
        <ol>
          {timeline.map((t, i) => (
            <Fragment key={t.topicId}>
              {i === todayAt && <TodayMarker />}
              <RoadmapItem
                goalId={goalId}
                topic={t}
                selected={filter === t.topicId}
                onSelect={() => onFilter(filter === t.topicId ? 'ALL' : t.topicId!)}
              >
                <TopicTasks
                  open={byTopic.open.get(t.topicId) ?? []}
                  done={byTopic.done.get(t.topicId) ?? []}
                  today={today}
                  collapsed={t.status === 'DONE'}
                  onOpen={onOpen}
                  onToggle={onToggle}
                  onAdd={() => onAdd(t.topicId)}
                />
              </RoadmapItem>
            </Fragment>
          ))}
          {todayAt === timeline.length && <TodayMarker />}
          {noTopicOpen.length > 0 && (
            <NoTopicItem count={noTopicOpen.length}>
              <TopicTasks
                open={noTopicOpen}
                done={[]}
                today={today}
                collapsed={false}
                onOpen={onOpen}
                onToggle={onToggle}
                onAdd={() => onAdd(null)}
              />
            </NoTopicItem>
          )}
          <li className="flex items-center gap-3">
            <span className="bg-ink text-on-ink grid size-7 shrink-0 place-items-center rounded-full">
              <Flag className="size-3.5" />
            </span>
            <span className="text-[13px] font-bold">
              {s.topicsDone === s.topicsTotal ? '모두 끝냈어요' : `${s.topicsTotal - s.topicsDone}개 남았어요`}
            </span>
          </li>
        </ol>
      )}
      <div className="mt-4">
        <AddTopic goalId={goalId} onCreated={(id) => onFilter(id)} />
      </div>
      {timeline.length > 0 && (
        <p className="text-ink-4 mt-2 text-[11px]">
          주제 점을 누르면 &lsquo;끝냈어요&rsquo;로 표시돼요 · 주제 이름을 누르면 아래 보드에서 그 주제만 봐요
        </p>
      )}
    </Section>
  )
}

// ─── 2. Task 한 줄 (오늘 · 마감 임박 · 할 일 목록) ───────────────────

function CheckButton({ task, onToggle, small = false }: { task: WorkTask; onToggle: () => void; small?: boolean }) {
  const done = task.status === 'DONE'
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={done}
      aria-label={`${task.taskName} ${done ? '완료 취소' : '완료'}`}
      className={cn(
        'grid shrink-0 place-items-center rounded-full border-2 transition-colors',
        small ? 'size-5' : 'size-6',
        done ? 'border-brand bg-brand text-white' : 'border-line-strong hover:border-brand text-transparent'
      )}
    >
      <Check className={small ? 'size-3' : 'size-3.5'} strokeWidth={3} />
    </button>
  )
}

function TaskMeta({ task, today, showTopic = true }: { task: WorkTask; today: string; showTopic?: boolean }) {
  const due = dueLabel(task)
  return (
    <span className="text-ink-3 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
      {showTopic && task.topicName && <span className="bg-subtle text-ink-2 rounded px-1.5">{task.topicName}</span>}
      {task.routine && <span className="text-brand font-semibold">반복</span>}
      {task.status === 'IN_PROGRESS' && <span className="text-brand font-semibold">진행 중</span>}
      {task.date && task.date !== today && <span>{dayLabel(task.date, today)}</span>}
      {task.startTime && <span>{task.startTime}</span>}
      {due && (
        <span
          className={cn('font-semibold', task.overdue ? 'text-danger' : task.dueInDays! <= 2 ? 'text-warning-ink' : '')}
        >
          {due}
        </span>
      )}
    </span>
  )
}

// ─── 3. 적기 패널 (할 일 · 한 일 · 회고) ─────────────────────────────

type WhenOption = 'BACKLOG' | 'TODAY' | 'DATE'

/** 할 일 적기 — 브레인덤프처럼 여러 줄을 붙여 넣으면 한 번에 추가 */
function TaskCompose({
  goalId,
  topics,
  topicId,
  onTopic,
  inputRef,
}: {
  goalId: number
  topics: WorkTopic[]
  topicId: number | null
  onTopic: (id: number | null) => void
  inputRef: RefObject<HTMLTextAreaElement | null>
}) {
  const one = useCreateWorkTask(goalId)
  const many = useCreateWorkTasks(goalId)
  const [text, setText] = useState('')
  const [when, setWhen] = useState<WhenOption>('BACKLOG')
  const [date, setDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const saving = one.isPending || many.isPending
  const realTopics = topics.filter((t) => t.topicId !== null)

  const day = when === 'TODAY' ? todayKst() : when === 'DATE' ? date || null : null
  const submit = () => {
    if (!lines.length || saving || (when === 'DATE' && !date)) return
    const common = { topicId, date: day, dueDate: dueDate || null }
    const done = () => setText('')
    if (lines.length === 1) one.mutate({ taskName: lines[0].slice(0, 100), ...common }, { onSuccess: done })
    else many.mutate({ text, ...common }, { onSuccess: done })
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div>
      <select
        value={topicId ?? ''}
        onChange={(e) => onTopic(e.target.value ? Number(e.target.value) : null)}
        aria-label="주제"
        className="border-line-strong bg-surface h-9 w-full rounded-xl border px-2.5 text-[14px] font-semibold"
      >
        <option value="">주제 없음</option>
        {realTopics.map((t) => (
          <option key={t.topicId} value={t.topicId!}>
            {t.emoji ? `${t.emoji} ` : ''}
            {t.name}
            {t.dueDate ? ` (~${shortDate(t.dueDate)})` : ''}
          </option>
        ))}
      </select>
      <textarea
        ref={inputRef}
        id="work-quick-add"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        rows={Math.min(Math.max(lines.length + 1, 4), 10)}
        placeholder={'해야 할 일을 한 줄에 하나씩 적어 주세요\n여러 줄을 붙여 넣으면 한 번에 추가돼요'}
        aria-label="해야 할 일"
        className={`${inlineInput} mt-2 h-auto resize-none py-2.5 leading-relaxed`}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="bg-subtle inline-flex rounded-lg p-0.5" role="radiogroup" aria-label="언제 할지">
          {(
            [
              ['BACKLOG', '나중에'],
              ['TODAY', '오늘'],
              ['DATE', '날짜'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={when === v}
              onClick={() => setWhen(v)}
              className={cn(
                'h-7 rounded-md px-2.5 text-[12px] font-semibold',
                when === v ? 'bg-surface text-ink shadow-sm' : 'text-ink-3'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {when === 'DATE' && (
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="하는 날"
            className="border-line-strong bg-surface h-8 rounded-lg border px-2 text-[13px]"
          />
        )}
        <label className="text-ink-3 flex items-center gap-1 text-[12px]">
          마감
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="border-line-strong bg-surface text-ink h-8 rounded-lg border px-2 text-[13px]"
          />
        </label>
      </div>
      <Button
        className="mt-3"
        fullWidth
        loading={saving}
        disabled={!lines.length || (when === 'DATE' && !date)}
        onClick={submit}
      >
        {lines.length > 1 ? `${lines.length}개 추가` : '할 일 추가'}
      </Button>
      <p className="text-ink-4 mt-1.5 text-[11px] leading-relaxed">
        Enter 추가 · Shift+Enter 줄바꿈 · &lsquo;나중에&rsquo;는 캘린더에 안 올리고 로드맵 · 보드에만 담아요
      </p>
    </div>
  )
}

/** 회고 적기 + 최근 회고 */
function RetroCompose({ goalId, board }: { goalId: number; board: WorkBoard }) {
  const create = useCreateWorkRetro(goalId)
  const remove = useDeleteWorkRetro(goalId)
  const [text, setText] = useState('')
  const submit = () => {
    if (!text.trim() || create.isPending) return
    create.mutate(text.trim(), { onSuccess: () => setText('') })
  }
  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            submit()
          }
        }}
        rows={4}
        aria-label="회고"
        placeholder="오늘 일하며 배운 점 · 막힌 점 · 다음에 바꿀 점"
        className={`${inlineInput} h-auto resize-none py-2.5 leading-relaxed`}
      />
      <Button className="mt-3" fullWidth loading={create.isPending} disabled={!text.trim()} onClick={submit}>
        회고 남기기
      </Button>
      {board.retrospectives.length > 0 && (
        <>
          <div className="mt-4 mb-1 flex items-center">
            <p className="text-ink-3 text-[12px] font-semibold">최근 회고</p>
            <Link
              href={`/goal/${goalId}?tab=reflections`}
              className="text-brand ml-auto text-[12px] font-semibold hover:underline"
            >
              모두 보기
            </Link>
          </div>
          <ul className="divide-line divide-y">
            {board.retrospectives.map((r) => (
              <li key={r.retrospectiveId} className="group flex gap-2 py-2">
                <span className="text-ink-3 w-12 shrink-0 text-[12px] leading-5">
                  {dayLabel(r.reviewDate, board.today)}
                </span>
                <p className="min-w-0 flex-1 text-[13px] leading-5 whitespace-pre-wrap">{r.content}</p>
                <button
                  type="button"
                  onClick={() => remove.mutate(r.retrospectiveId)}
                  aria-label="회고 지우기"
                  className="text-ink-4 hover:text-danger shrink-0 self-start p-0.5 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

type ComposeTab = 'task' | 'log' | 'retro'

const COMPOSE_TABS: { value: ComposeTab; label: string; icon: typeof Check }[] = [
  { value: 'task', label: '할 일', icon: ListTodo },
  { value: 'log', label: '한 일', icon: PenLine },
  { value: 'retro', label: '회고', icon: MessageSquareText },
]

/**
 * 적기 패널 — 할 일 · 실제로 한 일 · 회고를 한곳에서 적어요 (넓은 화면에선 오른쪽에 붙어 있어요).
 * 화면 가운데에 입력창이 흩어져 있으면 "여기에 적는 건가?" 헷갈려서 한데 모았어요.
 */
function ComposePanel({
  goal,
  board,
  tab,
  onTab,
  topicId,
  onTopic,
  inputRef,
}: {
  goal: GoalCategory
  board: WorkBoard
  tab: ComposeTab
  onTab: (t: ComposeTab) => void
  topicId: number | null
  onTopic: (id: number | null) => void
  inputRef: RefObject<HTMLTextAreaElement | null>
}) {
  return (
    <Card id="work-compose" className="scroll-mt-4 p-4 sm:p-5">
      <h2 className="flex items-center gap-1.5 text-[17px] font-bold">
        <PencilLine className="size-4" />
        적기
      </h2>
      <div className="bg-subtle mt-3 grid grid-cols-3 rounded-xl p-1" role="tablist" aria-label="무엇을 적을지">
        {COMPOSE_TABS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => onTab(value)}
            className={cn(
              'flex h-9 items-center justify-center gap-1 rounded-lg text-[13px] font-semibold transition-colors',
              tab === value ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2'
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {tab === 'task' ? (
          <TaskCompose
            goalId={goal.goalCategoryId}
            topics={board.topics}
            topicId={topicId}
            onTopic={onTopic}
            inputRef={inputRef}
          />
        ) : tab === 'log' ? (
          <RecordQuickLog goal={goal} bare />
        ) : (
          <RetroCompose goalId={goal.goalCategoryId} board={board} />
        )}
      </div>
    </Card>
  )
}

// ─── 4. 주제 필터 ─────────────────────────────────────────────

function TopicBar({
  topics,
  filter,
  onFilter,
}: {
  topics: WorkTopic[]
  filter: TopicFilter
  onFilter: (f: TopicFilter) => void
}) {
  const total = topics.reduce((n, t) => n + t.remaining, 0)
  const chip = (selected: boolean) =>
    cn(
      'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors',
      selected ? 'border-ink bg-ink text-on-ink' : 'border-line-strong bg-surface text-ink-2 hover:border-ink-4'
    )

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="주제">
      <button
        type="button"
        role="tab"
        aria-selected={filter === 'ALL'}
        onClick={() => onFilter('ALL')}
        className={chip(filter === 'ALL')}
      >
        전체 <span className="tabular-nums opacity-60">{total}</span>
      </button>
      {topics.map((t) => {
        const selected = t.topicId === null ? filter === 'NONE' : filter === t.topicId
        return (
          <button
            key={t.topicId ?? 'none'}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onFilter(t.topicId === null ? 'NONE' : t.topicId)}
            className={chip(selected)}
          >
            {t.emoji ? `${t.emoji} ` : ''}
            {t.name} <span className="tabular-nums opacity-60">{t.remaining}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── 5. 보드 (시작 전 · 진행 중 · 완료) ─────────────────────────────

const COLUMNS: { key: WorkColumn; icon: typeof Check; list: 'notStarted' | 'inProgress' | 'done' }[] = [
  { key: 'NOT_STARTED', icon: CircleDashed, list: 'notStarted' },
  { key: 'IN_PROGRESS', icon: Loader, list: 'inProgress' },
  { key: 'DONE', icon: Check, list: 'done' },
]

function BoardCard({
  task,
  today,
  showTopic,
  onOpen,
  onMove,
}: {
  task: WorkTask
  today: string
  showTopic: boolean
  onOpen: () => void
  onMove: (to: WorkColumn) => void
}) {
  const next: WorkColumn | null =
    task.status === 'NOT_STARTED' ? 'IN_PROGRESS' : task.status === 'IN_PROGRESS' ? 'DONE' : null
  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(task.taskId))
        e.dataTransfer.effectAllowed = 'move'
      }}
      className={cn(
        'border-line bg-surface hover:border-line-strong group cursor-grab rounded-xl border p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] active:cursor-grabbing',
        task.overdue && 'border-danger/40'
      )}
    >
      <div className="flex items-start gap-2">
        <CheckButton task={task} onToggle={() => onMove(task.status === 'DONE' ? 'NOT_STARTED' : 'DONE')} />
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <span
            className={cn(
              'block text-[14px] leading-snug font-semibold',
              task.status === 'DONE' && 'text-ink-3 line-through'
            )}
          >
            {task.taskName}
          </span>
          <TaskMeta task={task} today={today} showTopic={showTopic} />
          {task.date === null && task.status !== 'DONE' && (
            <span className="text-ink-4 mt-0.5 block text-[11px]">할 일 목록</span>
          )}
          {task.memo && <span className="text-ink-3 mt-1 line-clamp-2 block text-[12px]">{task.memo}</span>}
        </button>
      </div>
      {next && (
        <button
          type="button"
          onClick={() => onMove(next)}
          className="text-ink-3 hover:text-brand mt-2 ml-8 text-[12px] font-semibold [@media(hover:hover)]:hidden [@media(hover:hover)]:group-hover:block"
        >
          {COLUMN_LABEL[next]}으로 →
        </button>
      )}
    </li>
  )
}

function Kanban({
  board,
  filter,
  onOpen,
  onMove,
}: {
  board: WorkBoard
  filter: TopicFilter
  onOpen: (t: WorkTask) => void
  onMove: (t: WorkTask, to: WorkColumn) => void
}) {
  const [over, setOver] = useState<WorkColumn | null>(null)
  const all = useMemo(() => [...board.board.notStarted, ...board.board.inProgress, ...board.board.done], [board])

  const onDrop = (e: DragEvent, to: WorkColumn) => {
    e.preventDefault()
    setOver(null)
    const id = Number(e.dataTransfer.getData('text/plain'))
    const task = all.find((t) => t.taskId === id)
    if (task && task.status !== to) onMove(task, to)
  }

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {COLUMNS.map(({ key, icon: Icon, list }) => {
        const items = board.board[list].filter((t) => matchTopic(t, filter))
        const count = key === 'DONE' && filter === 'ALL' ? board.board.doneTotal : items.length
        return (
          <section
            key={key}
            aria-label={COLUMN_LABEL[key]}
            onDragOver={(e) => {
              e.preventDefault()
              setOver(key)
            }}
            onDragLeave={() => setOver((o) => (o === key ? null : o))}
            onDrop={(e) => onDrop(e, key)}
            className={cn(
              'bg-subtle/70 min-h-[160px] rounded-2xl p-3 transition-colors',
              over === key && 'bg-brand-soft ring-brand/40 ring-2'
            )}
          >
            <h3 className="mb-2.5 flex items-center gap-1.5 px-1 text-[13px] font-bold">
              <Icon
                className={cn(
                  'size-4',
                  key === 'DONE' ? 'text-success' : key === 'IN_PROGRESS' ? 'text-brand' : 'text-ink-3'
                )}
              />
              {COLUMN_LABEL[key]}
              <span className="text-ink-3 font-semibold tabular-nums">{count}</span>
            </h3>
            {items.length === 0 ? (
              <p className="text-ink-4 px-1 py-6 text-center text-[12px]">
                {key === 'IN_PROGRESS'
                  ? '하고 있는 일을 여기로 끌어 오세요'
                  : key === 'DONE'
                    ? '끝낸 일이 여기 쌓여요'
                    : '할 일이 없어요'}
              </p>
            ) : (
              <ul className="space-y-2">
                {items.map((t) => (
                  <BoardCard
                    key={t.taskId}
                    task={t}
                    today={board.today}
                    showTopic={filter === 'ALL'}
                    onOpen={() => onOpen(t)}
                    onMove={(to) => onMove(t, to)}
                  />
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

// ─── 화면 ──────────────────────────────────────────────────────

/**
 * 업무형 목표의 "보드" 탭. 업무형은 목표 전체 마감이 없고 주제마다 마감이 있어요 (V53).
 *  왼쪽(넓게)
 *   1. 다음 마감 · 진행 요약
 *   2. 로드맵 — 주제를 마감 순서대로 세로 선 위에, 점과 점 사이에 그 주제의 남은 할 일
 *   3. 보드 (시작 전 · 진행 중 · 완료) — 끌어서 옮기기
 *   4. 업무 일지 (완료한 Task + 직접 남긴 기록) · 메모
 *  오른쪽(붙어 있는 패널): 적기 — 할 일 · 한 일 · 회고 입력을 한곳에 + 반복 루틴
 * 오늘 할 일 · 마감 임박은 홈에서 모든 목표를 모아 보여줘서 여기선 뺐어요.
 */
export function WorkBoardView({ goal }: { goal: GoalCategory }) {
  const goalId = goal.goalCategoryId
  const { data: board, isPending, isError, error, refetch } = useWorkBoard(goalId)
  const move = useMoveWorkTask(goalId)
  const [filter, setFilter] = useState<TopicFilter>('ALL')
  const [opened, setOpened] = useState<WorkTask | null>(null)
  const [sharing, setSharing] = useState(false)
  const [composeTab, setComposeTab] = useState<ComposeTab>('task')
  const [composeTopic, setComposeTopic] = useState<number | null>(null)
  const composeInput = useRef<HTMLTextAreaElement>(null)

  if (isPending) {
    return (
      <div className="grid h-60 place-items-center">
        <Spinner className="text-ink-3 size-6" />
      </div>
    )
  }
  if (isError || !board) {
    return (
      <Card className="p-8 text-center">
        <p className="font-bold">보드를 불러오지 못했어요</p>
        <p className="text-ink-3 mt-1 text-sm">{error?.message}</p>
        <Button className="mt-4" onClick={() => refetch()}>
          다시 시도
        </Button>
      </Card>
    )
  }

  const toggle = (t: WorkTask) => {
    if (t.routine) {
      // 루틴 Task 는 보드 칸이 없어서 상세 창에서 처리
      setOpened(t)
      return
    }
    move.mutate({ task: t, to: t.status === 'DONE' ? 'NOT_STARTED' : 'DONE' })
  }
  // 로드맵에서 주제를 고르면 보드가 그 주제만 보여주고, 보드로 내려가요
  const pickTopic = (f: TopicFilter) => {
    setFilter(f)
    if (f !== 'ALL') document.getElementById('work-board')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  // 로드맵 "+ 할 일" → 적기 패널을 그 주제로 맞추고 입력창에 커서
  const composeFor = (topicId: number | null) => {
    setComposeTab('task')
    setComposeTopic(topicId)
    requestAnimationFrame(() => {
      const el = composeInput.current
      if (!el) return
      // 넓은 화면은 패널이 옆에 붙어 있어 바로 보이고, 좁은 화면은 위에 있어서 올라가요
      if (el.getBoundingClientRect().top < 0 || el.getBoundingClientRect().bottom > window.innerHeight) {
        document.getElementById('work-compose')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      el.focus({ preventScroll: true })
    })
  }

  return (
    <div className="space-y-5">
      <SummaryHero board={board} onShare={() => setSharing(true)} />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* 적기 + 루틴 — 좁은 화면에선 맨 위, 넓은 화면에선 오른쪽에 붙어서 따라와요 (길면 패널 안에서 스크롤) */}
        <aside className="space-y-5 lg:sticky lg:top-4 lg:order-last lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:pb-1">
          <ComposePanel
            goal={goal}
            board={board}
            tab={composeTab}
            onTab={setComposeTab}
            topicId={composeTopic}
            onTopic={setComposeTopic}
            inputRef={composeInput}
          />
          {/* 반복 루틴 — 맨 아래에 있으면 잘 안 보여서 적기 패널 바로 아래로 */}
          <RoutinesSection goal={goal} />
        </aside>

        <div className="min-w-0 space-y-5">
          <Roadmap
            goalId={goalId}
            board={board}
            filter={filter}
            onFilter={pickTopic}
            onOpen={setOpened}
            onToggle={toggle}
            onAdd={composeFor}
          />

          <Card id="work-board" className="scroll-mt-4 p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[17px] font-bold">보드</h2>
              <span className="text-ink-3 text-[12px]">카드를 끌어서 칸을 옮기거나, 눌러서 자세히 고쳐요</span>
            </div>
            <TopicBar topics={board.topics} filter={filter} onFilter={setFilter} />
            <div className="mt-4">
              <Kanban
                board={board}
                filter={filter}
                onOpen={setOpened}
                onMove={(task, to) => move.mutate({ task, to })}
              />
            </div>
          </Card>

          <RecordJournal goalId={goalId} goalName={goal.goalCategoryName} />

          <GoalNotes goal={goal} />
        </div>
      </div>

      {opened && (
        <WorkTaskModal
          key={opened.taskId}
          goalId={goalId}
          task={opened}
          topics={board.topics}
          onClose={() => setOpened(null)}
        />
      )}
      <WorkShareModal goalId={goalId} open={sharing} onClose={() => setSharing(false)} />
    </div>
  )
}
