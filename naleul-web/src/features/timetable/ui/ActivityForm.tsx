'use client'

import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link2, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { useGoalCategories } from '@/features/goal/api'
import { isOngoing } from '@/features/goal/format'
import { useDeleteActivity, useSaveActivity } from '../api'
import { formatMinutes, minutesFrom, nowKst, timeToMinutes, toDateTime } from '../time'
import type { ActualActivity } from '../types'

/** 폼을 열 때의 초기값 */
export interface ActivityDraft {
  /** 있으면 수정, 없으면 새로 기록 */
  activity?: ActualActivity
  date: string
  /** 그날 0시 기준 분 (끝이 1440 이상이면 다음 날) */
  start: number
  end: number
  /** "이 시간에 다른 일을 했어요"로 열었을 때 원래 계획했던 Task */
  replaced?: { id: number; name: string } | null
}

/** 수정할 기록 → 폼 초기값 */
export function draftOf(a: ActualActivity): ActivityDraft {
  const date = a.startAt.slice(0, 10)
  return {
    activity: a,
    date,
    start: minutesFrom(date, a.startAt),
    end: minutesFrom(date, a.endAt),
    replaced: a.replacedTaskId ? { id: a.replacedTaskId, name: a.replacedTaskName ?? '계획했던 일' } : null,
  }
}

const input =
  'border-line-strong bg-surface placeholder:text-ink-4 focus:border-ink-3 h-10 w-full min-w-0 rounded-xl border px-3 text-[14px] outline-none'
const label = 'text-ink-3 mb-1 block text-[12px] font-medium'

/**
 * 실제로 한 일 기록 · 수정 (팝오버 안에서 바로).
 * Enter 저장(메모 칸은 Shift+Enter 줄바꿈), Esc 닫기. 삭제는 같은 자리에서 한 번 더 확인.
 * 끝 시각이 시작보다 이르면 다음 날로 봐요 (예: 23:30 ~ 00:30).
 */
export function ActivityForm({ draft, onDone }: { draft: ActivityDraft; onDone: () => void }) {
  const save = useSaveActivity()
  const remove = useDeleteActivity()
  const goals = useGoalCategories()
  const a = draft.activity

  const [title, setTitle] = useState(a?.title ?? '')
  const [emoji, setEmoji] = useState(a?.emoji ?? '')
  const [date, setDate] = useState(draft.date)
  const [start, setStart] = useState(formatMinutes(draft.start))
  const [end, setEnd] = useState(formatMinutes(draft.end))
  const [goalId, setGoalId] = useState<number | null>(a?.goalCategoryId ?? null)
  const [replaced, setReplaced] = useState(draft.replaced ?? null)
  const [memo, setMemo] = useState(a?.memo ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const now = nowKst()
  const s = timeToMinutes(start)
  let e = timeToMinutes(end)
  if (e <= s) e += 1440 // 자정을 넘긴 기록
  const startAt = toDateTime(date, s)
  const endAt = toDateTime(date, e)
  const nowAt = toDateTime(now.date, now.minutes)
  const minutes = e - s

  const error = !title.trim()
    ? null
    : endAt > nowAt
      ? '아직 오지 않은 시간은 기록할 수 없어요.'
      : minutes > 1440
        ? '24시간까지만 기록할 수 있어요.'
        : null
  const valid = !!title.trim() && !error && !!date && !!start && !!end

  const submit = (ev?: FormEvent) => {
    ev?.preventDefault()
    if (!valid || save.isPending) return
    save.mutate(
      {
        activityId: a?.activityId,
        title: title.trim(),
        emoji: emoji.trim() || null,
        startAt,
        endAt,
        goalCategoryId: goalId,
        replacedTaskId: replaced?.id ?? null,
        memo: memo.trim() || null,
      },
      { onSuccess: onDone }
    )
  }

  const onKeyDown = (ev: KeyboardEvent<HTMLFormElement>) => {
    if (ev.nativeEvent.isComposing) return
    if (ev.key === 'Enter' && !ev.shiftKey && ev.target instanceof HTMLTextAreaElement) {
      ev.preventDefault()
      submit()
    }
  }

  const durationText =
    minutes >= 60 ? `${Math.floor(minutes / 60)}시간${minutes % 60 ? ` ${minutes % 60}분` : ''}` : `${minutes}분`
  const activeGoals = (goals.data ?? []).filter((g) => isOngoing(g.goalCategoryStatus) || g.goalCategoryId === goalId)

  return (
    <form onSubmit={submit} onKeyDown={onKeyDown} className="space-y-3 p-5">
      {/* 오른쪽 위 닫기(X) 버튼 자리 비워 두기 */}
      <div className="pr-8">
        <p className="text-success text-[12px] font-bold">✓ 실제로 한 일</p>
        <p className="text-ink-3 mt-0.5 text-[12px]">계획과 상관없이 그 시간에 실제로 한 일을 남겨요.</p>
      </div>

      {replaced && (
        <p className="bg-subtle flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px]">
          <Link2 className="text-ink-3 size-3.5 shrink-0" />
          <span className="text-ink-3 shrink-0">계획</span>
          <b className="min-w-0 flex-1 truncate">{replaced.name}</b>
          <span className="text-ink-3 shrink-0">대신</span>
          <button
            type="button"
            onClick={() => setReplaced(null)}
            aria-label="계획 연결 끊기"
            className="text-ink-3 hover:text-ink rounded p-0.5"
          >
            <X className="size-3.5" />
          </button>
        </p>
      )}

      <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-2">
        <label>
          <span className={label}>이모지</span>
          <input
            value={emoji}
            onChange={(ev) => setEmoji(ev.target.value)}
            maxLength={16}
            placeholder="🙂"
            className={cn(input, 'px-1 text-center placeholder:opacity-40')}
          />
        </label>
        <label>
          <span className={label}>무엇을 했나요?</span>
          <input
            autoFocus
            value={title}
            onChange={(ev) => setTitle(ev.target.value)}
            maxLength={60}
            placeholder="예) 친구 만남, 유튜브, 낮잠"
            className={input}
          />
        </label>
      </div>

      <label className="block">
        <span className={label}>날짜</span>
        <input
          type="date"
          value={date}
          max={now.date}
          onChange={(ev) => setDate(ev.target.value || draft.date)}
          className={input}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className={label}>시작</span>
          <input type="time" value={start} onChange={(ev) => setStart(ev.target.value)} className={input} />
        </label>
        <label>
          <span className={label}>끝 {e >= 1440 && <span className="text-ink-4">(다음 날)</span>}</span>
          <input type="time" value={end} onChange={(ev) => setEnd(ev.target.value)} className={input} />
        </label>
      </div>

      <label className="block">
        <span className={label}>목표 (선택)</span>
        <select
          value={goalId ?? ''}
          onChange={(ev) => setGoalId(ev.target.value ? Number(ev.target.value) : null)}
          className={input}
        >
          <option value="">연결 안 함</option>
          {activeGoals.map((g) => (
            <option key={g.goalCategoryId} value={g.goalCategoryId}>
              {g.emoji ? `${g.emoji} ` : ''}
              {g.goalCategoryName}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className={label}>메모 (선택)</span>
        <textarea
          value={memo}
          onChange={(ev) => setMemo(ev.target.value)}
          rows={2}
          maxLength={200}
          placeholder="왜 계획과 달라졌는지 적어 두면 패턴을 보기 좋아요"
          className={cn(input, 'h-auto resize-none py-2 leading-relaxed')}
        />
      </label>

      {error && (
        <p role="alert" className="text-danger text-[13px] font-medium">
          {error}
        </p>
      )}

      {confirmDelete ? (
        <div className="border-danger/30 bg-danger-soft/60 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5">
          <p className="min-w-0 flex-1 text-[14px] font-semibold">이 기록을 지울까요?</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
            취소
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            autoFocus
            loading={remove.isPending}
            onClick={() => remove.mutate(a!.activityId, { onSuccess: onDone })}
          >
            삭제
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 pt-1">
          {a && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-danger hover:bg-danger-soft"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-4" />
              삭제
            </Button>
          )}
          <span className="text-ink-3 ml-auto text-[12px] tabular-nums">{valid ? durationText : ''}</span>
          <Button type="submit" size="sm" loading={save.isPending} disabled={!valid}>
            {a ? '저장' : '기록'}
          </Button>
        </div>
      )}
    </form>
  )
}
