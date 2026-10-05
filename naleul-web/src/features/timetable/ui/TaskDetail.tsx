'use client'

import { useState } from 'react'
import {
  CalendarClock,
  Check,
  Clock,
  Ellipsis,
  Flag,
  Lock,
  LockOpen,
  Repeat,
  Sparkles,
  Trash,
  Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Chip'
import { cn } from '@/lib/cn'
import { hexOf } from '../layout'
import { formatDuration, formatMonthDay, minutesFrom } from '../time'
import type { TimeBlockTask } from '../types'

export interface TaskActions {
  onToggleComplete: (t: TimeBlockTask) => void
  onEditTime: (t: TimeBlockTask) => void
  onUnlock: (t: TimeBlockTask) => void
  onUnschedule: (t: TimeBlockTask) => void
  onDelete: (t: TimeBlockTask) => void
  /** "계획과 다른 시간에 했어요" — 실제 시각을 입력하고 완료 (나의 패턴 시작 지연 계산용) */
  onCompleteWithTime?: (t: TimeBlockTask) => void
}

/** 어떤 작업을 할 수 있는지 (백엔드 규칙과 같게) */
export function taskPermissions(t: TimeBlockTask) {
  const done = t.taskStatus === 'COMPLETED'
  const mission = t.sourceType === 'MISSION'
  return {
    editTime: !done && !mission, // 완료·미션 Task 는 시간 변경 409
    unlock: t.locked && !done && !mission,
    unschedule: t.sourceType === 'MANUAL' && !!t.plannedStartAt && !done, // 루틴·미션은 400
    delete: !mission,
  }
}

function timeLine(t: TimeBlockTask) {
  const day = t.date ?? t.scheduledDate
  if (!t.plannedStartAt) return day ? `${formatMonthDay(day)} · 시간 미정` : '날짜 미정'
  const base = t.plannedStartAt.slice(0, 10)
  const s = minutesFrom(base, t.plannedStartAt)
  const e = t.plannedEndAt ? minutesFrom(base, t.plannedEndAt) : null
  const hhmm = (m: number) =>
    `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const range = e !== null ? `${hhmm(s)} – ${e >= 1440 ? `다음 날 ${hhmm(e)}` : hhmm(e)}` : hhmm(s)
  return `${formatMonthDay(base)} · ${range}${e !== null && e > s ? ` (${formatDuration(e - s)})` : ''}`
}

export function TaskDetail({ task: t, busy, actions }: { task: TimeBlockTask; busy?: boolean; actions: TaskActions }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const perm = taskPermissions(t)
  const done = t.taskStatus === 'COMPLETED'
  const color = hexOf(t.goalColorCode)

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

      <h3 className={cn('mt-2.5 text-lg leading-snug font-bold', done && 'text-ink-3 line-through')}>
        {t.emoji ? `${t.emoji} ` : ''}
        {t.taskName}
      </h3>

      <dl className="text-ink-2 mt-3 space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <Clock className="text-ink-3 mt-0.5 size-4 shrink-0" />
          <dd>{timeLine(t)}</dd>
        </div>
        {t.goalCategoryName && (
          <div className="flex items-start gap-2">
            <span className="mt-1 size-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <dd className="min-w-0">
              {t.goalEmoji ? `${t.goalEmoji} ` : ''}
              {t.goalCategoryName}
              {t.goalTemporary && <span className="text-ink-3"> · 임시 목표</span>}
              {t.generalCategoryName && <span className="text-ink-3"> › {t.generalCategoryName}</span>}
            </dd>
          </div>
        )}
        {t.milestoneTitle && (
          <div className="flex items-start gap-2">
            <Flag className="text-ink-3 mt-0.5 size-4 shrink-0" />
            <dd>{t.milestoneTitle}</dd>
          </div>
        )}
        {t.dueDate && (
          <div className="flex items-start gap-2">
            <CalendarClock className="text-ink-3 mt-0.5 size-4 shrink-0" />
            <dd>{formatMonthDay(t.dueDate)}까지</dd>
          </div>
        )}
        {t.carryOverCount > 0 && (
          <div className="flex items-start gap-2">
            <Undo2 className="text-ink-3 mt-0.5 size-4 shrink-0" />
            <dd>{t.carryOverCount}번 미뤄진 Task예요</dd>
          </div>
        )}
      </dl>

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

      {/* 버튼 */}
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
        {perm.editTime && (
          <Button variant="secondary" className="flex-1" onClick={() => actions.onEditTime(t)}>
            시간 변경
          </Button>
        )}
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
                  <MenuItem danger onClick={() => actions.onDelete(t)}>
                    <Trash className="size-4" />
                    삭제
                  </MenuItem>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {!done && t.plannedStartAt && t.sourceType !== 'MISSION' && actions.onCompleteWithTime && (
        <button
          type="button"
          onClick={() => actions.onCompleteWithTime?.(t)}
          className="text-ink-3 hover:text-ink mt-2.5 w-full text-center text-[13px] underline-offset-2 hover:underline"
        >
          계획과 다른 시간에 했어요
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
