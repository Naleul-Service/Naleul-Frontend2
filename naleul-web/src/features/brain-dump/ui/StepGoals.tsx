'use client'

import { useState } from 'react'
import { AlertCircle, CalendarClock, Clock, Pencil, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Chip'
import { cn } from '@/lib/cn'
import type { GoalCategory } from '@/features/goal/api'
import { hexOf } from '@/features/timetable/layout'
import { formatDuration, formatMonthDay } from '@/features/timetable/time'
import type { ConfirmItem, TempGoalInput } from '../types'
import { ItemEditModal } from './ItemEditModal'

/** 2단계에서 고치는 Task 하나 = 확정 요청 Item + AI 가 붙인 연결 이유 */
export interface MapItem extends ConfirmItem {
  reason?: string | null
}

export const MAX_TEMP_GOALS = 5

interface Props {
  items: MapItem[]
  tempGoals: TempGoalInput[]
  goals: GoalCategory[]
  aiFailed: boolean
  /** clientKey → 겹친 일정 안내 (확정 시 409 성격의 conflicts) */
  conflicts: Record<string, string>
  today: string
  loading: boolean
  onChange: (items: MapItem[], tempGoals: TempGoalInput[]) => void
  onBack: () => void
  onConfirm: () => void
}

type Group = { key: string; title: string; emoji?: string | null; color: string; temp: boolean; items: MapItem[] }

/**
 * 2단계 · 목표 연결 (명세 3-2)
 *  - AI 결과를 목표별로 묶어서 보여줘요. 관련 목표가 없으면 임시 목표.
 *  - "변경"으로 목표·날짜·시간·소요 시간·중요도를 고쳐요.
 *  - 모든 Task 가 목표에 연결돼야 "TimeBlock 만들기"를 누를 수 있어요 (백엔드 BRAIN_DUMP_GOAL_REQUIRED).
 */
export function StepGoals({
  items,
  tempGoals,
  goals,
  aiFailed,
  conflicts,
  today,
  loading,
  onChange,
  onBack,
  onConfirm,
}: Props) {
  const [editing, setEditing] = useState<MapItem | null>(null)

  const groups: Group[] = []
  const byKey = new Map<string, Group>()
  for (const it of items) {
    let key = 'none'
    let g: Omit<Group, 'items'> = { key, title: '목표를 골라 주세요', color: '#B8BCC4', temp: false }
    if (it.goalCategoryId) {
      const goal = goals.find((x) => x.goalCategoryId === it.goalCategoryId)
      key = `g${it.goalCategoryId}`
      g = {
        key,
        title: goal?.goalCategoryName ?? '목표',
        emoji: goal?.emoji,
        color: hexOf(goal?.colorCode),
        temp: false,
      }
    } else if (it.tempGoalKey) {
      const t = tempGoals.find((x) => x.tempKey === it.tempGoalKey)
      key = `t:${it.tempGoalKey}`
      g = { key, title: t?.name ?? '임시 목표', emoji: t?.emoji, color: '#F59E0B', temp: true }
    }
    if (!byKey.has(key)) {
      const group = { ...g, items: [] }
      byKey.set(key, group)
      groups.push(group)
    }
    byKey.get(key)!.items.push(it)
  }
  // 목표가 없는 묶음은 맨 위에 (먼저 고르도록)
  groups.sort((a, b) => (a.key === 'none' ? -1 : b.key === 'none' ? 1 : 0))
  const missing = items.filter((i) => !i.goalCategoryId && !i.tempGoalKey).length
  const blankTemp = tempGoals.some((t) => !t.name.trim())

  const renameTemp = (tempKey: string, name: string) =>
    onChange(
      items,
      tempGoals.map((t) => (t.tempKey === tempKey ? { ...t, name: name.slice(0, 30) } : t))
    )

  const save = (next: MapItem, newTemp?: TempGoalInput) => {
    const list = items.map((i) => (i.clientKey === next.clientKey ? next : i))
    const temps = newTemp ? [...tempGoals, newTemp] : tempGoals
    // 아무 Task 도 가리키지 않는 임시 목표는 만들지 않아요
    const used = new Set(list.map((i) => i.tempGoalKey).filter(Boolean))
    onChange(
      list,
      temps.filter((t) => used.has(t.tempKey))
    )
    setEditing(null)
  }

  const nextTempKey = `t${tempGoals.reduce((m, t) => Math.max(m, Number(t.tempKey.slice(1)) || 0), 0) + 1}`

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-[17px] font-bold">목표에 연결했어요</h2>
      <p className="text-ink-3 mt-1 text-sm">
        잘못 연결됐거나 날짜·시간이 다르면 &quot;변경&quot;을 눌러 고쳐 주세요. 관련 목표가 없는 일은 임시 목표로
        묶었어요.
      </p>

      {aiFailed && (
        <p className="bg-warning-soft mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm text-[#b45309]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          AI 정리가 잠시 안 돼서, 적은 내용만 나눠 두었어요. 목표는 &quot;변경&quot;에서 직접 골라 주세요.
        </p>
      )}
      {Object.keys(conflicts).length > 0 && (
        <p className="bg-danger-soft text-danger mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          직접 정한 시간이 다른 일정과 겹쳐서 저장하지 않았어요. 빨갛게 표시된 Task의 시간을 바꿔 주세요.
        </p>
      )}

      <div className="mt-5 space-y-5">
        {groups.map((g) => (
          <section key={g.key} aria-label={g.title}>
            <header className="mb-2 flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
              {g.temp ? (
                <span className="flex min-w-0 items-center gap-1.5">
                  {g.emoji && <span>{g.emoji}</span>}
                  <input
                    value={g.title}
                    onChange={(e) => renameTemp(g.key.slice(2), e.target.value)}
                    aria-label="임시 목표 이름"
                    size={Math.max(g.title.length * 2, 6)}
                    className="focus:border-brand min-w-0 border-b border-transparent bg-transparent text-[15px] font-bold outline-none"
                  />
                  <Pencil className="text-ink-4 size-3.5 shrink-0" aria-hidden />
                  <Badge tone="warning">임시 목표</Badge>
                </span>
              ) : (
                <h3 className={cn('text-[15px] font-bold', g.key === 'none' && 'text-danger')}>
                  {g.emoji ? `${g.emoji} ` : ''}
                  {g.title}
                </h3>
              )}
              <span className="text-ink-4 text-xs">{g.items.length}개</span>
            </header>
            <ul className="space-y-2">
              {g.items.map((it) => (
                <ItemRow
                  key={it.clientKey}
                  item={it}
                  goals={goals}
                  conflict={conflicts[it.clientKey]}
                  onEdit={() => setEditing(it)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        {missing > 0 && <span className="text-danger text-sm">{missing}개 Task의 목표를 골라 주세요</span>}
        {blankTemp && <span className="text-danger text-sm">임시 목표 이름을 입력해 주세요</span>}
        <Button variant="secondary" onClick={onBack} disabled={loading}>
          이전
        </Button>
        <Button onClick={onConfirm} disabled={missing > 0 || blankTemp || loading} loading={loading}>
          TimeBlock 만들기
        </Button>
      </div>

      {editing && (
        <ItemEditModal
          key={editing.clientKey}
          item={editing}
          goals={goals}
          tempGoals={tempGoals}
          today={today}
          nextTempKey={nextTempKey}
          canAddTemp={tempGoals.length < MAX_TEMP_GOALS}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  )
}

const PRIORITY_LABEL: Record<string, string> = { A: '아주 중요', B: '중요', C: '보통', D: '가벼움', E: '여유' }

function ItemRow({
  item: it,
  goals,
  conflict,
  onEdit,
}: {
  item: MapItem
  goals: GoalCategory[]
  conflict?: string
  onEdit: () => void
}) {
  const goal = it.goalCategoryId ? goals.find((g) => g.goalCategoryId === it.goalCategoryId) : undefined
  const sub = goal?.generalCategories.find((c) => c.generalCategoryId === it.generalCategoryId)
  const ms = goal?.milestones?.find((m) => m.milestoneId === it.milestoneId)
  const dateLabel =
    it.dateType === 'DUE' && it.dueDate
      ? `${formatMonthDay(it.dueDate)}까지`
      : it.dateType === 'ON' && it.scheduledDate
        ? formatMonthDay(it.scheduledDate)
        : '날짜 없음'

  return (
    <li
      data-item={it.clientKey}
      className={cn('border-line rounded-2xl border px-4 py-3', conflict && 'border-danger bg-danger-soft/40')}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{it.title}</p>
          <p className="text-ink-3 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="flex items-center gap-1">
              <CalendarClock className="size-3.5" />
              {dateLabel}
            </span>
            {it.startTime && (
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" />
                {it.startTime.slice(0, 5)}
                {it.endTime ? `–${it.endTime.slice(0, 5)}` : ''} 🔒
              </span>
            )}
            <span>예상 {formatDuration(it.estimatedMinutes ?? 30)}</span>
            <span>{PRIORITY_LABEL[it.priority ?? 'C']}</span>
            {it.kind === 'APPOINTMENT' && <Badge tone="warning">약속</Badge>}
            {sub && <span>› {sub.generalCategoryName}</span>}
            {ms && <span>🏁 {ms.title}</span>}
          </p>
          {it.reason && !conflict && (
            <p className="text-ink-3 mt-1.5 flex items-start gap-1 text-xs">
              <Sparkles className="text-brand mt-0.5 size-3 shrink-0" />
              {it.reason}
            </p>
          )}
          {conflict && <p className="text-danger mt-1.5 text-xs font-semibold">{conflict}</p>}
        </div>
        <Button variant="secondary" size="sm" onClick={onEdit} aria-label={`${it.title} 변경`}>
          변경
        </Button>
      </div>
    </li>
  )
}
