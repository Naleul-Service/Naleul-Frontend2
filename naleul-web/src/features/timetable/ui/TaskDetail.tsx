'use client'

import { useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  CalendarClock,
  Check,
  Clock,
  Ellipsis,
  Flag,
  Layers,
  Lock,
  LockOpen,
  Pencil,
  Repeat,
  Sparkles,
  Trash,
  Undo2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Chip'
import { cn } from '@/lib/cn'
import { useGoalCategory } from '@/features/goal/api'
import { InlineConfirm } from '@/features/goal/edit/inline'
import { useUpdateGoalTask, type GoalTaskInput } from '@/features/goal/edit/mutations'
import { useRescheduleTask, useRoutineScopedReschedule, type ChangeScope } from '../api'
import { hexOf } from '../layout'
import {
  formatDuration,
  formatMonthDay,
  minutesFrom,
  minutesToTime,
  nowKst,
  timeToMinutes,
  toDateTime,
  todayKst,
} from '../time'
import type { TimeBlockTask } from '../types'
import { ScopeChips, scopeOptions } from './ScopeChooser'

export interface TaskActions {
  onToggleComplete: (t: TimeBlockTask) => void
  onUnlock: (t: TimeBlockTask) => void
  onUnschedule: (t: TimeBlockTask) => void
  /** 삭제 확인 띄우기 (Delete 키와 같은 동작) */
  onDelete: (t: TimeBlockTask) => void
  /** "계획과 다른 시간에 했어요" — 실제 시각을 입력하고 완료 (나의 패턴 시작 지연 계산용) */
  onCompleteWithTime?: (t: TimeBlockTask) => void
  /** "이 시간에 다른 일을 했어요" — 계획 대신 실제로 한 일 기록 */
  onRecordInstead?: (t: TimeBlockTask) => void
}

/** 어떤 작업을 할 수 있는지 (백엔드 규칙과 같게) */
export function taskPermissions(t: TimeBlockTask) {
  const done = t.taskStatus === 'COMPLETED'
  const mission = t.sourceType === 'MISSION'
  return {
    editTime: !done && !mission, // 완료·미션 Task 는 시간 변경 409
    // 이름·세부 목표·마일스톤·마감일: 목표에 연결된 일회성 Task 만 (루틴은 루틴에서, 미션은 방장이 정함)
    editContent: t.sourceType === 'MANUAL' && !!t.goalCategoryId && !!t.generalCategoryId,
    unlock: t.locked && !done && !mission,
    unschedule: t.sourceType === 'MANUAL' && !!t.plannedStartAt && !done, // 루틴·미션은 400
    delete: !mission,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
const hhmm = (m: number) => `${pad(Math.floor((m % 1440) / 60))}:${pad(m % 60)}`

/** "11월 18일 (수) · 09:00 – 10:30 (1시간 30분)" */
function rangeText(startAt: string, endAt?: string | null) {
  const base = startAt.slice(0, 10)
  const s = minutesFrom(base, startAt)
  const e = endAt ? minutesFrom(base, endAt) : null
  const range = e !== null ? `${hhmm(s)} – ${e >= 1440 ? `다음 날 ${hhmm(e)}` : hhmm(e)}` : hhmm(s)
  return `${formatMonthDay(base)} · ${range}${e !== null && e > s ? ` (${formatDuration(e - s)})` : ''}`
}

function timeLine(t: TimeBlockTask) {
  const day = t.date ?? t.scheduledDate
  if (!t.plannedStartAt) return day ? `${formatMonthDay(day)} · 시간 미정` : '날짜 미정'
  return rangeText(t.plannedStartAt, t.plannedEndAt)
}

/** 목표 상세 Task 수정 API 에 보낼 "지금 값 그대로"의 폼 (바꿀 항목만 덮어써서 보내요) */
function currentInput(t: TimeBlockTask): GoalTaskInput {
  const day = t.plannedStartAt?.slice(0, 10) ?? t.date ?? t.scheduledDate ?? todayKst()
  let startTime: string | null = null
  let endTime: string | null = null
  if (t.plannedStartAt) {
    const s = minutesFrom(day, t.plannedStartAt)
    const e = t.plannedEndAt ? minutesFrom(day, t.plannedEndAt) : s + (t.plannedDurationMinutes ?? 30)
    startTime = minutesToTime(s)
    endTime = minutesToTime(e)
  }
  const dur = t.plannedDurationMinutes
  return {
    taskName: t.taskName,
    emoji: t.emoji ?? null,
    generalCategoryId: t.generalCategoryId!,
    milestoneId: t.milestoneId ?? null,
    date: day,
    startTime,
    endTime,
    durationMinutes: !t.plannedStartAt && dur && dur >= 5 && dur <= 720 ? dur : null,
    dueDate: t.dueDate ?? null,
  }
}

/** Enter = 저장, Esc = 취소 (창은 닫지 않음). 한글 조합 중 Enter 는 무시 */
const editKeys = (save: () => void, cancel: () => void) => (e: KeyboardEvent<HTMLElement>) => {
  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
    e.preventDefault()
    save()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    cancel()
  }
}

const field =
  'border-line-strong bg-surface focus:border-ink-3 h-9 w-full min-w-0 rounded-lg border px-2.5 text-[14px] outline-none'

/** 한 줄 속성 — 누르면 그 자리에서 수정 (노션처럼) */
function Prop({
  icon,
  editable,
  onEdit,
  label,
  children,
}: {
  icon: ReactNode
  editable?: boolean
  onEdit?: () => void
  label: string
  children: ReactNode
}) {
  const body = <span className="min-w-0 flex-1">{children}</span>
  return (
    <div className="flex items-start gap-2">
      <span className="mt-[3px] shrink-0">{icon}</span>
      {editable ? (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`${label} 수정`}
          className="group/prop hover:bg-subtle -mx-1.5 -my-0.5 flex min-w-0 flex-1 items-start gap-1 rounded-md px-1.5 py-0.5 text-left"
        >
          {body}
          <Pencil className="text-ink-4 mt-1 size-3 shrink-0 opacity-0 group-hover/prop:opacity-100" />
        </button>
      ) : (
        body
      )}
    </div>
  )
}

type EditKey = 'title' | 'time' | 'sub' | 'milestone' | 'due' | null

/** 시간 바로 고치기: 날짜 · 시작 · 종료 (+ 루틴이면 적용 범위) */
function TimeEditor({
  task: t,
  saving,
  onSave,
  onCancel,
}: {
  task: TimeBlockTask
  saving: boolean
  onSave: (date: string, start: number, end: number, scope: ChangeScope) => void
  onCancel: () => void
}) {
  const today = todayKst()
  const day = t.plannedStartAt?.slice(0, 10) ?? t.date ?? t.scheduledDate ?? today
  const s0 = t.plannedStartAt ? minutesFrom(day, t.plannedStartAt) : 9 * 60
  const e0 = t.plannedEndAt ? minutesFrom(day, t.plannedEndAt) : s0 + (t.plannedDurationMinutes ?? 60)
  const [date, setDate] = useState(day)
  const [start, setStart] = useState(minutesToTime(s0))
  const [end, setEnd] = useState(minutesToTime(e0))
  const [scope, setScope] = useState<ChangeScope>('DAY')
  const routine = t.sourceType === 'ROUTINE'

  const s = start ? timeToMinutes(start) : NaN
  let e = end ? timeToMinutes(end) : NaN
  if (e <= s) e += 1440
  const valid = !!date && !Number.isNaN(s) && !Number.isNaN(e) && e - s > 0 && e - s < 1440
  const options = routine
    ? scopeOptions({ kind: 'routine', isToday: date === today, sameDay: date === day, crossesMidnight: e >= 1440 })
    : null
  const effective = options?.find((o) => o.scope === scope && !o.disabledReason) ? scope : 'DAY'
  const save = () => valid && !saving && onSave(date, s, e, effective)

  return (
    <div
      className="border-brand/40 bg-brand-soft/40 -mx-1.5 space-y-2 rounded-xl border p-2.5"
      onKeyDown={editKeys(save, onCancel)}
    >
      <input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} className={field} aria-label="날짜" />
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
        <input
          type="time"
          step={600}
          value={start}
          onChange={(ev) => setStart(ev.target.value)}
          className={field}
          aria-label="시작"
          autoFocus
        />
        <span className="text-ink-3 text-xs">–</span>
        <input
          type="time"
          step={600}
          value={end}
          onChange={(ev) => setEnd(ev.target.value)}
          className={field}
          aria-label="종료"
        />
      </div>
      {options && <ScopeChips options={options} value={effective} onChange={setScope} />}
      <div className="flex items-center gap-1.5">
        <span className="text-ink-3 flex-1 text-[11px]">
          {valid
            ? `${formatDuration(e - s)}${e >= 1440 ? ' · 다음 날까지' : ''} · Enter 저장 · Esc 취소`
            : '시간을 확인해 주세요'}
        </span>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
          취소
        </Button>
        <Button size="sm" onClick={save} disabled={!valid} loading={saving}>
          저장
        </Button>
      </div>
    </div>
  )
}

export function TaskDetail({
  task: t,
  busy,
  actions,
  confirmingDelete,
  deleting,
  onConfirmDelete,
  onCancelDelete,
}: {
  task: TimeBlockTask
  busy?: boolean
  actions: TaskActions
  /** Delete 키·삭제 메뉴로 "삭제할까요?"를 띄운 상태 */
  confirmingDelete?: boolean
  deleting?: boolean
  onConfirmDelete?: () => void
  onCancelDelete?: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState<EditKey>(null)
  const [draft, setDraft] = useState({ emoji: '', name: '' })
  const perm = taskPermissions(t)
  const done = t.taskStatus === 'COMPLETED'
  const color = hexOf(t.goalColorCode)
  const actual = t.taskStatus === 'COMPLETED' && t.actualStartAt && t.actualEndAt ? t : null

  const goalId = t.goalCategoryId ?? 0
  const updateTask = useUpdateGoalTask(goalId)
  const reschedule = useRescheduleTask()
  const routineScoped = useRoutineScopedReschedule()
  // 세부 목표·마일스톤을 고를 때만 목표 정보를 불러와요
  const goal = useGoalCategory(goalId, perm.editContent && (editing === 'sub' || editing === 'milestone'))
  const subs = (goal.data?.generalCategories ?? []).filter((s) => s.generalCategoryStatus !== 'DELETED')
  const milestones = [...(goal.data?.milestones ?? [])].sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  const stop = () => setEditing(null)
  const saveContent = (patch: Partial<GoalTaskInput>) =>
    updateTask.mutate({ taskId: t.taskId, ...currentInput(t), ...patch }, { onSuccess: stop })

  const startTitle = () => {
    setDraft({ emoji: t.emoji ?? '', name: t.taskName })
    setEditing('title')
  }
  const saveTitle = () => {
    if (updateTask.isPending) return // Enter 로 저장한 직후 blur 가 한 번 더 부르는 것 방지
    const name = draft.name.trim()
    if (!name) return stop()
    if (name === t.taskName && (draft.emoji.trim() || null) === (t.emoji ?? null)) return stop()
    saveContent({ taskName: name, emoji: draft.emoji.trim() || null })
  }

  const saveTime = (date: string, s: number, e: number, scope: ChangeScope) => {
    const body = { taskId: t.taskId, plannedStartAt: toDateTime(date, s), plannedEndAt: toDateTime(date, e) }
    if (t.sourceType === 'ROUTINE') routineScoped.mutate({ ...body, scope }, { onSuccess: stop })
    else reschedule.mutate(body, { onSuccess: stop })
  }

  const empty = (label: string) => <span className="text-ink-4">{label}</span>

  return (
    <div className="p-5">
      {/* 상태 표시 */}
      <div className="flex flex-wrap items-center gap-1.5 pr-8">
        {done && <Badge tone="success">완료</Badge>}
        {t.missed && <Badge tone="danger">놓침</Badge>}
        {t.sourceType === 'ROUTINE' && (
          <Badge>
            <Repeat className="size-3" />
            루틴
          </Badge>
        )}
        {t.sourceType === 'MISSION' && <Badge>미션</Badge>}
        {t.taskKind === 'APPOINTMENT' && <Badge tone="warning">약속</Badge>}
        {t.locked ? (
          <Badge>
            <Lock className="size-3" />
            직접 정한 시간
          </Badge>
        ) : (
          t.placedBy === 'ENGINE' && (
            <Badge tone="brand">
              <Sparkles className="size-3" />
              자동 배치
            </Badge>
          )
        )}
      </div>

      {/* 제목 — 누르면 바로 수정 */}
      {editing === 'title' ? (
        <div className="mt-2 flex gap-1.5" onKeyDown={editKeys(saveTitle, stop)}>
          <input
            value={draft.emoji}
            onChange={(e) => setDraft((d) => ({ ...d, emoji: e.target.value }))}
            maxLength={16}
            placeholder="🙂"
            aria-label="이모지"
            className={cn(field, 'h-10 w-12 shrink-0 text-center placeholder:opacity-40')}
          />
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            onBlur={(e) => {
              // 이모지 칸으로 옮겨 가는 건 저장하지 않아요
              if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) saveTitle()
            }}
            maxLength={100}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Task 이름"
            className={cn(field, 'h-10 text-[16px] font-bold')}
          />
        </div>
      ) : perm.editContent ? (
        <button
          type="button"
          onClick={startTitle}
          className="group/title hover:bg-subtle -mx-1.5 mt-2 flex w-[calc(100%+12px)] items-start gap-1.5 rounded-lg px-1.5 py-0.5 text-left"
        >
          <h3 className={cn('min-w-0 flex-1 text-lg leading-snug font-bold', done && 'text-ink-3 line-through')}>
            {t.emoji ? `${t.emoji} ` : ''}
            {t.taskName}
          </h3>
          <Pencil className="text-ink-4 mt-1.5 size-3.5 shrink-0 opacity-0 group-hover/title:opacity-100" />
        </button>
      ) : (
        <h3 className={cn('mt-2.5 text-lg leading-snug font-bold', done && 'text-ink-3 line-through')}>
          {t.emoji ? `${t.emoji} ` : ''}
          {t.taskName}
        </h3>
      )}

      <div className="text-ink-2 mt-3 space-y-2 text-sm">
        {/* 시간 */}
        {actual && (
          <Prop icon={<Check className="text-success size-4" />} label="실제 시간">
            <span className="text-ink-3 mr-1">실제</span>
            {rangeText(actual.actualStartAt!, actual.actualEndAt)}
          </Prop>
        )}
        {editing === 'time' ? (
          <TimeEditor
            task={t}
            saving={reschedule.isPending || routineScoped.isPending}
            onSave={saveTime}
            onCancel={stop}
          />
        ) : (
          <Prop
            icon={<Clock className="text-ink-3 size-4" />}
            label="시간"
            editable={perm.editTime}
            onEdit={() => setEditing('time')}
          >
            {actual && <span className="text-ink-3 mr-1">계획</span>}
            <span className={actual ? 'text-ink-3' : undefined}>{timeLine(t)}</span>
          </Prop>
        )}

        {/* 목표 › 세부 목표 */}
        {t.goalCategoryName &&
          (editing === 'sub' ? (
            <select
              autoFocus
              value={t.generalCategoryId ?? ''}
              disabled={goal.isPending || updateTask.isPending}
              onChange={(e) => saveContent({ generalCategoryId: Number(e.target.value) })}
              onBlur={stop}
              onKeyDown={editKeys(stop, stop)}
              className={field}
              aria-label="세부 목표"
            >
              {goal.isPending && <option>불러오는 중…</option>}
              {subs.map((s) => (
                <option key={s.generalCategoryId} value={s.generalCategoryId}>
                  {s.generalCategoryName}
                </option>
              ))}
            </select>
          ) : (
            <Prop
              icon={<span className="mt-0.5 block size-3 rounded-full" style={{ backgroundColor: color }} />}
              label="세부 목표"
              editable={perm.editContent}
              onEdit={() => setEditing('sub')}
            >
              {t.goalEmoji ? `${t.goalEmoji} ` : ''}
              {t.goalCategoryName}
              {t.goalTemporary && <span className="text-ink-3"> · 임시 목표</span>}
              {t.generalCategoryName && <span className="text-ink-3"> › {t.generalCategoryName}</span>}
            </Prop>
          ))}

        {/* 마일스톤 */}
        {(t.milestoneTitle || perm.editContent) &&
          (editing === 'milestone' ? (
            <select
              autoFocus
              value={t.milestoneId ?? ''}
              disabled={goal.isPending || updateTask.isPending}
              onChange={(e) => saveContent({ milestoneId: e.target.value ? Number(e.target.value) : null })}
              onBlur={stop}
              onKeyDown={editKeys(stop, stop)}
              className={field}
              aria-label="마일스톤"
            >
              <option value="">없음</option>
              {milestones.map((m) => (
                <option key={m.milestoneId} value={m.milestoneId}>
                  {m.title}
                </option>
              ))}
            </select>
          ) : (
            <Prop
              icon={<Flag className="text-ink-3 size-4" />}
              label="마일스톤"
              editable={perm.editContent}
              onEdit={() => setEditing('milestone')}
            >
              {t.milestoneTitle ?? empty('마일스톤 없음')}
            </Prop>
          ))}

        {/* 마감일 */}
        {(t.dueDate || perm.editContent) &&
          (editing === 'due' ? (
            <div className="flex items-center gap-1.5" onKeyDown={editKeys(stop, stop)}>
              <input
                type="date"
                autoFocus
                defaultValue={t.dueDate ?? ''}
                disabled={updateTask.isPending}
                onChange={(e) => e.target.value && saveContent({ dueDate: e.target.value })}
                className={field}
                aria-label="마감일"
              />
              {t.dueDate && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => saveContent({ dueDate: null })}
                  disabled={updateTask.isPending}
                >
                  <X className="size-3.5" />
                  지우기
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={stop}>
                닫기
              </Button>
            </div>
          ) : (
            <Prop
              icon={<CalendarClock className="text-ink-3 size-4" />}
              label="마감일"
              editable={perm.editContent}
              onEdit={() => setEditing('due')}
            >
              {t.dueDate ? `${formatMonthDay(t.dueDate)}까지` : empty('마감일 없음')}
            </Prop>
          ))}

        {t.carryOverCount > 0 && (
          <Prop icon={<Undo2 className="text-ink-3 size-4" />} label="미뤄진 횟수">
            {t.carryOverCount}번 미뤄진 Task예요
          </Prop>
        )}
        {t.sourceType === 'ROUTINE' && (
          <Prop icon={<Layers className="text-ink-3 size-4" />} label="루틴 안내">
            <span className="text-ink-3 text-[13px]">이름은 목표 상세의 루틴에서 바꿀 수 있어요.</span>
          </Prop>
        )}
      </div>

      {/* 배치 이유 (명세: 항상 설명) */}
      {t.placementReason && !t.locked && (
        <div className="bg-brand-soft mt-4 rounded-xl px-3.5 py-3">
          <p className="text-brand flex items-center gap-1 text-xs font-bold">
            <Sparkles className="size-3.5" />이 시간에 놓은 이유
          </p>
          <p className="text-ink-2 mt-1 text-[13px] leading-relaxed">{t.placementReason}</p>
        </div>
      )}
      {t.locked && !done && (
        <p className="bg-subtle text-ink-3 mt-4 rounded-xl px-3.5 py-2.5 text-xs leading-relaxed">
          직접 정한 시간이라 자동 배치가 옮기지 않아요.
        </p>
      )}

      {/* 삭제 확인 (Delete 키 · 삭제 메뉴) */}
      {confirmingDelete ? (
        <div className="mt-5">
          <InlineConfirm
            message={`'${t.taskName}'을 삭제할까요?`}
            detail={
              t.sourceType === 'ROUTINE'
                ? '이 날짜의 루틴 Task 하나만 지워져요.'
                : '되돌릴 수 없어요. Enter 삭제 · Esc 취소'
            }
            loading={deleting}
            onConfirm={() => onConfirmDelete?.()}
            onCancel={() => onCancelDelete?.()}
          />
        </div>
      ) : (
        <div className="mt-5 flex items-center gap-2">
          <Button
            variant={done ? 'secondary' : 'brand'}
            className="flex-1"
            loading={busy}
            onClick={() => actions.onToggleComplete(t)}
          >
            {!done && <Check className="size-4" strokeWidth={2.6} />}
            {done ? '완료 취소' : '완료'}
          </Button>
          {(perm.unlock || perm.unschedule || perm.delete) && (
            <div className="relative">
              <Button
                variant="secondary"
                className="w-10 px-0"
                aria-label="다른 작업"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <Ellipsis className="size-4" />
              </Button>
              {menuOpen && (
                <div
                  role="menu"
                  className="bg-surface shadow-pop border-line absolute right-0 bottom-12 z-10 w-44 overflow-hidden rounded-xl border py-1"
                >
                  {perm.unlock && (
                    <MenuItem onClick={() => actions.onUnlock(t)}>
                      <LockOpen className="size-4" />
                      잠금 해제
                    </MenuItem>
                  )}
                  {perm.unschedule && (
                    <MenuItem onClick={() => actions.onUnschedule(t)}>
                      <Clock className="size-4" />
                      시간 미정으로
                    </MenuItem>
                  )}
                  {perm.delete && (
                    <MenuItem
                      danger
                      onClick={() => {
                        setMenuOpen(false)
                        actions.onDelete(t)
                      }}
                    >
                      <Trash className="size-4" />
                      삭제
                      <kbd className="text-ink-4 ml-auto text-[10px]">Del</kbd>
                    </MenuItem>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {!done && !confirmingDelete && t.plannedStartAt && t.sourceType !== 'MISSION' && actions.onCompleteWithTime && (
        <button
          type="button"
          onClick={() => actions.onCompleteWithTime?.(t)}
          className="text-ink-3 hover:text-ink mt-2.5 w-full text-center text-[13px] underline-offset-2 hover:underline"
        >
          계획과 다른 시간에 했어요
        </button>
      )}
      {/* 계획 시각이 이미 시작됐는데 안 했으면: 그 시간에 실제로 한 일을 남길 수 있게 */}
      {!done &&
        !confirmingDelete &&
        t.plannedStartAt &&
        t.plannedStartAt <= toDateTime(nowKst().date, nowKst().minutes) &&
        actions.onRecordInstead && (
          <button
            type="button"
            onClick={() => actions.onRecordInstead?.(t)}
            className="text-success hover:bg-success-soft mt-1 w-full rounded-lg py-1.5 text-center text-[13px] font-semibold"
          >
            이 시간에 다른 일을 했어요
          </button>
        )}
    </div>
  )
}

function MenuItem({ danger, onClick, children }: { danger?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'hover:bg-subtle flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm',
        danger ? 'text-danger' : 'text-ink-2'
      )}
    >
      {children}
    </button>
  )
}
