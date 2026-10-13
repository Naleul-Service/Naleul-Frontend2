'use client'

import { useMemo, useState, type DragEvent, type KeyboardEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  Check,
  ChevronDown,
  CircleDashed,
  ListTodo,
  Loader,
  Pencil,
  Plus,
  Share2,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import type { GoalCategory } from '@/features/goal/api'
import { useUpdateGoal } from '@/features/goal/edit/mutations'
import { inlineInput } from '@/features/goal/edit/inline'
import { Section } from '@/features/goal/ui/sections'
import { todayKst } from '@/features/timetable/time'
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
  workKeys,
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

// ─── 1. 마감 · 진행 요약 ────────────────────────────────────────

function DeadlineEditor({ goal, onDone }: { goal: GoalCategory; onDone: () => void }) {
  const qc = useQueryClient()
  const update = useUpdateGoal(goal.goalCategoryId)
  const [value, setValue] = useState(goal.goalCategoryEndDate ?? '')
  const save = (clear: boolean) =>
    update.mutate(clear ? { clearEndDate: true } : { goalCategoryEndDate: value }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: workKeys.all })
        onDone()
      },
    })
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <input
        type="date"
        value={value}
        min={goal.goalCategoryStartDate ?? undefined}
        onChange={(e) => setValue(e.target.value)}
        aria-label="마감일"
        className="h-9 rounded-xl border border-white/30 bg-white/10 px-3 text-[14px] text-white [color-scheme:dark] outline-none"
        autoFocus
      />
      <Button size="sm" variant="secondary" loading={update.isPending} disabled={!value} onClick={() => save(false)}>
        저장
      </Button>
      {goal.goalCategoryEndDate && (
        <button
          type="button"
          onClick={() => save(true)}
          className="text-[13px] font-semibold text-white/75 hover:text-white"
        >
          마감 없이 진행
        </button>
      )}
      <button type="button" onClick={onDone} aria-label="닫기" className="text-white/70 hover:text-white">
        <X className="size-4" />
      </button>
    </div>
  )
}

function Meter({ label, value, tone }: { label: string; value: number | null; tone: 'task' | 'time' }) {
  if (value === null) return null
  return (
    <div>
      <div className="mb-1 flex justify-between text-[12px] text-white/75">
        <span>{label}</span>
        <span className="font-semibold text-white tabular-nums">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/15">
        <div
          className={cn('h-full rounded-full', tone === 'task' ? 'bg-white' : 'bg-white/45')}
          style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
        />
      </div>
    </div>
  )
}

function SummaryHero({ goal, board, onShare }: { goal: GoalCategory; board: WorkBoard; onShare: () => void }) {
  const s = board.summary
  const [editing, setEditing] = useState(false)
  const dday = goalDDay(s.dDay)
  const late =
    s.progressPercent !== null && s.timePercent !== null && s.remaining > 0 && s.timePercent - s.progressPercent >= 15

  return (
    <section className="bg-inverse rounded-[24px] p-6 text-white sm:p-7">
      <div className="flex flex-wrap items-start gap-x-8 gap-y-5">
        {/* 마감 */}
        <div className="min-w-[180px]">
          <p className="flex items-center gap-1.5 text-[13px] text-white/70">
            <CalendarDays className="size-4" />
            마감
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="ml-1 flex items-center gap-0.5 rounded-md px-1 text-[12px] font-semibold text-white/80 hover:bg-white/10 hover:text-white"
              >
                <Pencil className="size-3" />
                {s.deadline ? '바꾸기' : '정하기'}
              </button>
            )}
          </p>
          {s.deadline ? (
            <>
              <p
                className={cn(
                  'mt-1 text-[44px] leading-none font-bold tracking-tight',
                  s.dDay! < 0 && 'text-[#FCA5A5]'
                )}
              >
                {dday}
              </p>
              <p className="mt-1.5 text-[14px] text-white/80">{fullDate(s.deadline)}까지</p>
            </>
          ) : (
            <>
              <p className="mt-1 text-[28px] leading-tight font-bold">마감 없음</p>
              <p className="mt-1.5 text-[13px] text-white/70">마감을 정하면 하루에 몇 개씩 해야 하는지 알려드려요</p>
            </>
          )}
          {editing && <DeadlineEditor goal={goal} onDone={() => setEditing(false)} />}
        </div>

        {/* 진행 */}
        <div className="min-w-[220px] flex-1">
          <p className="text-[13px] text-white/70">진행</p>
          <p className="mt-1 text-[32px] leading-none font-bold">
            {s.done}
            <span className="text-[18px] font-semibold text-white/60"> / {s.total}개 완료</span>
          </p>
          <div className="mt-4 space-y-2.5">
            <Meter label="Task 완료" value={s.progressPercent} tone="task" />
            <Meter label="기간 경과" value={s.timePercent} tone="time" />
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
        {s.overdue > 0 && <Pill tone="danger">마감 지남 {s.overdue}개</Pill>}
        {s.dueThisWeek > 0 && <Pill tone="warning">이번 주 마감 {s.dueThisWeek}개</Pill>}
        {s.remainingPerDay !== null && s.remainingPerDay > 0 && <Pill>{paceLabel(s.remainingPerDay)}</Pill>}
        {late && <Pill tone="warning">기간보다 진행이 늦어요</Pill>}
      </div>
    </section>
  )
}

/** 마감까지 속도 — 하루 1개 이상이면 "하루 2개씩", 적으면 "3일에 1개씩" */
function paceLabel(perDay: number) {
  if (perDay >= 1) return `마감까지 하루 ${String(Math.round(perDay * 10) / 10).replace(/\.0$/, '')}개씩`
  return `마감까지 ${Math.max(Math.round(1 / perDay), 2)}일에 1개씩`
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

// ─── 2. Task 한 줄 (오늘 · 마감 임박 · 할 일 목록) ───────────────────

function CheckButton({ task, onToggle }: { task: WorkTask; onToggle: () => void }) {
  const done = task.status === 'DONE'
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={done}
      aria-label={`${task.taskName} ${done ? '완료 취소' : '완료'}`}
      className={cn(
        'grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors',
        done ? 'border-brand bg-brand text-white' : 'border-line-strong hover:border-brand text-transparent'
      )}
    >
      <Check className="size-3.5" strokeWidth={3} />
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

function TaskLine({
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
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className="pt-0.5">
        <CheckButton task={task} onToggle={onToggle} />
      </span>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className={cn('block text-[14px] font-semibold', task.status === 'DONE' && 'text-ink-3 line-through')}>
          {task.emoji ? `${task.emoji} ` : ''}
          {task.taskName}
        </span>
        <TaskMeta task={task} today={today} />
      </button>
    </li>
  )
}

// ─── 3. 빠른 추가 (브레인덤프처럼 여러 줄) ────────────────────────────

type WhenOption = 'BACKLOG' | 'TODAY' | 'DATE'

function QuickAdd({
  goalId,
  topics,
  defaultTopic,
}: {
  goalId: number
  topics: WorkTopic[]
  defaultTopic: TopicFilter
}) {
  const one = useCreateWorkTask(goalId)
  const many = useCreateWorkTasks(goalId)
  const [text, setText] = useState('')
  const [topicId, setTopicId] = useState<number | null>(typeof defaultTopic === 'number' ? defaultTopic : null)
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
    <Card className="p-4 sm:p-5">
      <label htmlFor="work-quick-add" className="flex items-center gap-1.5 text-[15px] font-bold">
        <ListTodo className="size-4" />
        해야 할 일 적기
      </label>
      <textarea
        id="work-quick-add"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        rows={Math.min(Math.max(lines.length + 1, 3), 8)}
        placeholder={'떠오르는 대로 한 줄에 하나씩 적어 주세요\n여러 줄을 붙여 넣으면 한 번에 추가돼요'}
        className={`${inlineInput} mt-2 h-auto resize-none py-2.5 leading-relaxed`}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          value={topicId ?? ''}
          onChange={(e) => setTopicId(e.target.value ? Number(e.target.value) : null)}
          aria-label="주제"
          className="border-line-strong bg-surface h-8 rounded-lg border px-2 text-[13px]"
        >
          <option value="">주제 없음</option>
          {realTopics.map((t) => (
            <option key={t.topicId} value={t.topicId!}>
              {t.name}
            </option>
          ))}
        </select>
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
        <Button
          size="sm"
          className="ml-auto"
          loading={saving}
          disabled={!lines.length || (when === 'DATE' && !date)}
          onClick={submit}
        >
          {lines.length > 1 ? `${lines.length}개 추가` : '추가'}
        </Button>
      </div>
      <p className="text-ink-4 mt-1.5 text-[11px]">
        Enter 추가 · Shift+Enter 줄바꿈 · &lsquo;나중에&rsquo;는 캘린더에 안 올리고 할 일 목록에만 담아요
      </p>
    </Card>
  )
}

// ─── 4. 주제 ─────────────────────────────────────────────────

function TopicBar({
  goalId,
  topics,
  filter,
  onFilter,
}: {
  goalId: number
  topics: WorkTopic[]
  filter: TopicFilter
  onFilter: (f: TopicFilter) => void
}) {
  const create = useCreateWorkTopic(goalId)
  const update = useUpdateWorkTopic(goalId)
  const remove = useDeleteWorkTopic(goalId)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [renaming, setRenaming] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const total = topics.reduce((n, t) => n + t.remaining, 0)
  const active = typeof filter === 'number' ? topics.find((t) => t.topicId === filter) : undefined

  const add = () => {
    const v = name.trim()
    if (!v) return
    create.mutate(
      { name: v },
      {
        onSuccess: (t) => {
          setName('')
          setAdding(false)
          onFilter(t.topicId)
        },
      }
    )
  }

  const chip = (selected: boolean) =>
    cn(
      'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors',
      selected ? 'border-ink bg-ink text-on-ink' : 'border-line-strong bg-surface text-ink-2 hover:border-ink-4'
    )

  return (
    <div>
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
        {topics.map((t) =>
          renaming !== null && renaming === t.topicId ? (
            <form
              key={t.topicId}
              onSubmit={(e) => {
                e.preventDefault()
                if (renameValue.trim())
                  update.mutate(
                    { topicId: t.topicId!, name: renameValue.trim() },
                    { onSuccess: () => setRenaming(null) }
                  )
              }}
            >
              <input
                autoFocus
                value={renameValue}
                maxLength={30}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => setRenaming(null)}
                onKeyDown={(e) => e.key === 'Escape' && setRenaming(null)}
                aria-label="주제 이름"
                className="border-ink h-8 w-32 rounded-full border px-3 text-[13px] outline-none"
              />
            </form>
          ) : (
            <button
              key={t.topicId ?? 'none'}
              type="button"
              role="tab"
              aria-selected={t.topicId === null ? filter === 'NONE' : filter === t.topicId}
              onClick={() => onFilter(t.topicId === null ? 'NONE' : t.topicId)}
              className={chip(t.topicId === null ? filter === 'NONE' : filter === t.topicId)}
            >
              {t.emoji ? `${t.emoji} ` : ''}
              {t.name} <span className="tabular-nums opacity-60">{t.remaining}</span>
            </button>
          )
        )}
        {adding ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              add()
            }}
            className="flex items-center gap-1"
          >
            <input
              autoFocus
              value={name}
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setAdding(false)}
              placeholder="예: 백엔드"
              aria-label="새 주제 이름"
              className="border-brand h-8 w-32 rounded-full border px-3 text-[13px] outline-none"
            />
            <Button size="sm" type="submit" loading={create.isPending} disabled={!name.trim()}>
              만들기
            </Button>
            <button type="button" onClick={() => setAdding(false)} aria-label="취소" className="text-ink-3 p-1">
              <X className="size-4" />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-ink-3 hover:text-ink border-line-strong flex h-8 items-center gap-1 rounded-full border border-dashed px-3 text-[13px] font-semibold"
          >
            <Plus className="size-3.5" />
            주제
          </button>
        )}
      </div>
      {active && active.topicId !== null && (
        <p className="text-ink-3 mt-2 flex items-center gap-2 text-[12px]">
          {active.name} · 완료 {active.done} / {active.total}
          <button
            type="button"
            onClick={() => {
              setRenaming(active.topicId)
              setRenameValue(active.name)
            }}
            className="hover:text-ink flex items-center gap-0.5 font-semibold"
          >
            <Pencil className="size-3" />
            이름 바꾸기
          </button>
          <button
            type="button"
            onClick={() => remove.mutate(active.topicId!, { onSuccess: () => onFilter('ALL') })}
            className="hover:text-danger flex items-center gap-0.5 font-semibold"
          >
            <Trash2 className="size-3" />
            주제 지우기
          </button>
        </p>
      )}
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

// ─── 6. 아카이브 · 회고 ──────────────────────────────────────────

function ArchiveSection({ board, onOpen }: { board: WorkBoard; onOpen: (t: WorkTask) => void }) {
  const [openDays, setOpenDays] = useState<Set<string>>(() => new Set(board.archive.slice(0, 2).map((d) => d.date)))
  const total = board.archive.reduce((n, d) => n + d.count, 0)
  return (
    <Section title="해 온 일" aside={total ? `최근 30일 ${total}개` : undefined}>
      {board.archive.length === 0 ? (
        <p className="text-ink-3 text-sm">완료한 Task가 날짜별로 여기 쌓여요.</p>
      ) : (
        <ol className="space-y-1">
          {board.archive.map((d) => {
            const open = openDays.has(d.date)
            return (
              <li key={d.date}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() =>
                    setOpenDays((s) => {
                      const n = new Set(s)
                      if (n.has(d.date)) n.delete(d.date)
                      else n.add(d.date)
                      return n
                    })
                  }
                  className="hover:bg-subtle flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px]"
                >
                  <span className="font-semibold">{dayLabel(d.date, board.today)}</span>
                  <span className="text-ink-3">{d.count}개</span>
                  <ChevronDown className={cn('text-ink-3 ml-auto size-4 transition-transform', open && 'rotate-180')} />
                </button>
                {open && (
                  <ul className="border-line mb-2 ml-3 border-l pl-3">
                    {d.tasks.map((t) => (
                      <li key={t.taskId}>
                        <button
                          type="button"
                          onClick={() => onOpen(t)}
                          className="text-ink-2 hover:text-ink flex w-full items-center gap-2 py-1 text-left text-[13px]"
                        >
                          <Check className="text-success size-3.5 shrink-0" strokeWidth={3} />
                          <span className="min-w-0 flex-1 truncate">{t.taskName}</span>
                          {t.topicName && <span className="text-ink-4 shrink-0 text-[11px]">{t.topicName}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </Section>
  )
}

function RetroSection({ goalId, board }: { goalId: number; board: WorkBoard }) {
  const create = useCreateWorkRetro(goalId)
  const remove = useDeleteWorkRetro(goalId)
  const [text, setText] = useState('')
  const submit = () => {
    if (!text.trim() || create.isPending) return
    create.mutate(text.trim(), { onSuccess: () => setText('') })
  }
  return (
    <Section title="회고">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            submit()
          }
        }}
        rows={3}
        placeholder="오늘 일하며 배운 점 · 막힌 점 · 다음에 바꿀 점"
        className={`${inlineInput} h-auto resize-none py-2 leading-relaxed`}
      />
      <div className="mt-2 flex justify-end">
        <Button size="sm" loading={create.isPending} disabled={!text.trim()} onClick={submit}>
          회고 남기기
        </Button>
      </div>
      {board.retrospectives.length > 0 && (
        <ul className="divide-line mt-3 divide-y">
          {board.retrospectives.map((r) => (
            <li key={r.retrospectiveId} className="group flex gap-3 py-2.5">
              <span className="text-ink-3 w-14 shrink-0 text-[12px] leading-5">
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
      )}
    </Section>
  )
}

// ─── 화면 ──────────────────────────────────────────────────────

/**
 * 업무형 목표의 "보드" 탭.
 *  1. 마감 · 진행 요약 (D-day, 완료/전체, 기간 대비 진행, 하루에 몇 개씩)
 *  2. 오늘 할 일 · 마감 임박 — 상세를 열자마자 "오늘 뭘 해야 하지?"에 답해요
 *  3. 해야 할 일 적기 — 여러 줄을 붙여 넣으면 한 번에 추가
 *  4. 주제 + 보드 (시작 전 · 진행 중 · 완료) — 끌어서 옮기기
 *  5. 해 온 일 (날짜별 아카이브) · 회고
 */
export function WorkBoardView({ goal }: { goal: GoalCategory }) {
  const goalId = goal.goalCategoryId
  const { data: board, isPending, isError, error, refetch } = useWorkBoard(goalId)
  const move = useMoveWorkTask(goalId)
  const [filter, setFilter] = useState<TopicFilter>('ALL')
  const [opened, setOpened] = useState<WorkTask | null>(null)
  const [sharing, setSharing] = useState(false)
  const [showDoneToday, setShowDoneToday] = useState(false)

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
      // 루틴 Task 는 보드 칸이 없어서 상세에서 처리 (업무 일지 탭)
      setOpened(t)
      return
    }
    move.mutate({ task: t, to: t.status === 'DONE' ? 'NOT_STARTED' : 'DONE' })
  }
  const today = board.today

  return (
    <div className="space-y-5">
      <SummaryHero goal={goal} board={board} onShare={() => setSharing(true)} />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Section title="오늘 할 일" aside={board.todayTasks.length ? `${board.todayTasks.length}개` : undefined}>
          {board.todayTasks.length === 0 ? (
            <p className="text-ink-3 text-sm">
              오늘로 정한 일이 없어요. 아래 보드에서 할 일을 골라 &lsquo;오늘 하기&rsquo;로 정해 보세요.
            </p>
          ) : (
            <ul className="divide-line -my-1 divide-y">
              {board.todayTasks.map((t) => (
                <TaskLine
                  key={t.taskId}
                  task={t}
                  today={today}
                  onOpen={() => setOpened(t)}
                  onToggle={() => toggle(t)}
                />
              ))}
            </ul>
          )}
          {board.doneToday.length > 0 && (
            <div className="border-line mt-3 border-t pt-2">
              <button
                type="button"
                onClick={() => setShowDoneToday((v) => !v)}
                aria-expanded={showDoneToday}
                className="text-success flex items-center gap-1 text-[13px] font-semibold"
              >
                오늘 끝낸 일 {board.doneToday.length}
                <ChevronDown className={cn('size-4 transition-transform', showDoneToday && 'rotate-180')} />
              </button>
              {showDoneToday && (
                <ul className="divide-line divide-y">
                  {board.doneToday.map((t) => (
                    <TaskLine
                      key={t.taskId}
                      task={t}
                      today={today}
                      onOpen={() => setOpened(t)}
                      onToggle={() => toggle(t)}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </Section>

        <Section title="마감 임박" aside="앞으로 2주">
          {board.upcoming.length === 0 ? (
            <p className="text-ink-3 text-sm">2주 안에 마감인 일이 없어요. Task에 마감을 정하면 여기 보여요.</p>
          ) : (
            <ul className="divide-line -my-1 divide-y">
              {board.upcoming.map((t) => (
                <li key={t.taskId} className="flex items-center gap-3 py-2.5">
                  <span
                    className={cn(
                      'grid h-9 w-12 shrink-0 place-items-center rounded-lg text-[12px] font-bold tabular-nums',
                      t.dueInDays! <= 2 ? 'bg-warning-soft text-warning-ink' : 'bg-subtle text-ink-2'
                    )}
                  >
                    D-{t.dueInDays}
                  </span>
                  <button type="button" onClick={() => setOpened(t)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-[14px] font-semibold">{t.taskName}</span>
                    <span className="text-ink-3 text-[12px]">
                      {t.dueDate && `${dayLabel(t.dueDate, today)} 마감`}
                      {t.topicName && ` · ${t.topicName}`}
                      {t.status === 'IN_PROGRESS' && ' · 진행 중'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <QuickAdd key={String(filter)} goalId={goalId} topics={board.topics} defaultTopic={filter} />

      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[17px] font-bold">보드</h2>
          <span className="text-ink-3 text-[12px]">카드를 끌어서 칸을 옮기거나, 눌러서 자세히 고쳐요</span>
        </div>
        <TopicBar goalId={goalId} topics={board.topics} filter={filter} onFilter={setFilter} />
        <div className="mt-4">
          <Kanban board={board} filter={filter} onOpen={setOpened} onMove={(task, to) => move.mutate({ task, to })} />
        </div>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ArchiveSection board={board} onOpen={setOpened} />
        <RetroSection goalId={goalId} board={board} />
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
