'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Modal } from '@/components/ui/Modal'
import type { GoalCategory } from '@/features/goal/api'
import type { TaskPriority } from '@/features/timetable/types'
import type { DateType, TempGoalInput } from '../types'
import type { MapItem } from './StepGoals'

const NEW_TEMP = '__new__'
const MINUTES = [10, 15, 20, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480]
const PRIORITIES: TaskPriority[] = ['A', 'B', 'C', 'D', 'E']
const PRIORITY_HINT: Record<TaskPriority, string> = {
  A: '가장 중요',
  B: '중요',
  C: '보통',
  D: '가벼움',
  E: '여유',
}

const field =
  'border-line-strong focus:border-brand h-11 w-full rounded-xl border bg-white px-3 text-[15px] outline-none'
const labelText = 'text-ink-3 mb-1 block text-xs font-medium'

/** goal 선택 값: "g12" (기존 목표) / "t:t1" (이번에 만드는 임시 목표) / "__new__" */
const goalValue = (i: MapItem) =>
  i.goalCategoryId ? `g${i.goalCategoryId}` : i.tempGoalKey ? `t:${i.tempGoalKey}` : ''

interface Props {
  item: MapItem
  goals: GoalCategory[]
  tempGoals: TempGoalInput[]
  today: string
  /** 새 임시 목표를 만들었으면 newTemp 도 같이 */
  onSave: (item: MapItem, newTemp?: TempGoalInput) => void
  onClose: () => void
  nextTempKey: string
  canAddTemp: boolean
}

/** 2단계 "변경" — 목표·세부 목표·마일스톤·날짜·시간·소요 시간·중요도 */
export function ItemEditModal({ item, goals, tempGoals, today, onSave, onClose, nextTempKey, canAddTemp }: Props) {
  const [f, setF] = useState<MapItem>(item)
  const [goalSel, setGoalSel] = useState(goalValue(item))
  const [newTempName, setNewTempName] = useState('')
  const [newTempEmoji, setNewTempEmoji] = useState('📌')

  const set = (p: Partial<MapItem>) => setF((x) => ({ ...x, ...p }))
  const goal = goalSel.startsWith('g') ? goals.find((g) => `g${g.goalCategoryId}` === goalSel) : undefined
  const subGoals = (goal?.generalCategories ?? []).filter((c) => c.generalCategoryStatus !== 'DELETED')
  const milestones = (goal?.milestones ?? []).filter((m) => m.status === 'PENDING')
  const date = f.dateType === 'DUE' ? f.dueDate : f.scheduledDate

  const setDateType = (t: DateType) =>
    set({
      dateType: t,
      scheduledDate: t === 'ON' ? (date ?? today) : null,
      dueDate: t === 'DUE' ? (date ?? today) : null,
      ...(t !== 'ON' ? { startTime: null, endTime: null } : {}),
    })
  const setDate = (d: string) => set(f.dateType === 'DUE' ? { dueDate: d } : { scheduledDate: d })

  const timeInvalid = !!(f.startTime && f.endTime && f.endTime <= f.startTime)
  const valid =
    f.title.trim().length > 0 &&
    !!goalSel &&
    (goalSel !== NEW_TEMP || newTempName.trim().length > 0) &&
    (f.dateType === 'NONE' || !!date) &&
    !timeInvalid

  const save = () => {
    if (!valid) return
    const base: MapItem = { ...f, title: f.title.trim() }
    if (goalSel === NEW_TEMP) {
      const temp = { tempKey: nextTempKey, name: newTempName.trim().slice(0, 30), emoji: newTempEmoji || null }
      onSave(
        { ...base, goalCategoryId: null, generalCategoryId: null, milestoneId: null, tempGoalKey: temp.tempKey },
        temp
      )
    } else if (goalSel.startsWith('t:')) {
      onSave({
        ...base,
        goalCategoryId: null,
        generalCategoryId: null,
        milestoneId: null,
        tempGoalKey: goalSel.slice(2),
      })
    } else {
      onSave({ ...base, goalCategoryId: Number(goalSel.slice(1)), tempGoalKey: null })
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Task 변경"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={save} disabled={!valid}>
            저장
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className={labelText}>할 일</span>
          <input
            value={f.title}
            maxLength={100}
            onChange={(e) => set({ title: e.target.value })}
            className={field}
            aria-label="할 일 이름"
          />
        </label>

        {/* 목표 */}
        <label className="block">
          <span className={labelText}>목표</span>
          <select
            value={goalSel}
            onChange={(e) => {
              setGoalSel(e.target.value)
              set({ generalCategoryId: null, milestoneId: null })
            }}
            className={field}
            aria-label="목표"
          >
            <option value="" disabled>
              목표를 골라 주세요
            </option>
            {goals.length > 0 && (
              <optgroup label="내 목표">
                {goals.map((g) => (
                  <option key={g.goalCategoryId} value={`g${g.goalCategoryId}`}>
                    {g.emoji ? `${g.emoji} ` : ''}
                    {g.goalCategoryName}
                  </option>
                ))}
              </optgroup>
            )}
            {tempGoals.length > 0 && (
              <optgroup label="이번에 만드는 임시 목표">
                {tempGoals.map((t) => (
                  <option key={t.tempKey} value={`t:${t.tempKey}`}>
                    {t.emoji ? `${t.emoji} ` : ''}
                    {t.name}
                  </option>
                ))}
              </optgroup>
            )}
            {canAddTemp && <option value={NEW_TEMP}>+ 새 임시 목표 만들기</option>}
          </select>
        </label>
        {goalSel === NEW_TEMP && (
          <div className="bg-subtle grid grid-cols-[64px_1fr] gap-2 rounded-xl p-3">
            <input
              value={newTempEmoji}
              onChange={(e) => setNewTempEmoji([...e.target.value].slice(-1).join(''))}
              aria-label="임시 목표 이모지"
              className={`${field} text-center`}
            />
            <input
              value={newTempName}
              maxLength={30}
              autoFocus
              onChange={(e) => setNewTempName(e.target.value)}
              placeholder="예) 이사 준비"
              aria-label="임시 목표 이름"
              className={field}
            />
            <p className="text-ink-3 col-span-2 text-xs">
              임시 목표는 나중에 AI 목표 만들기로 구체화할 수 있어요. 무료 목표 개수에 포함되지 않아요.
            </p>
          </div>
        )}
        {goal && (subGoals.length > 0 || milestones.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {subGoals.length > 0 && (
              <label className="block">
                <span className={labelText}>세부 목표</span>
                <select
                  value={f.generalCategoryId ?? ''}
                  onChange={(e) => set({ generalCategoryId: e.target.value ? Number(e.target.value) : null })}
                  className={field}
                  aria-label="세부 목표"
                >
                  <option value="">선택 안 함 (기타 할 일)</option>
                  {subGoals.map((c) => (
                    <option key={c.generalCategoryId} value={c.generalCategoryId}>
                      {c.generalCategoryName}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {milestones.length > 0 && (
              <label className="block">
                <span className={labelText}>마일스톤</span>
                <select
                  value={f.milestoneId ?? ''}
                  onChange={(e) => set({ milestoneId: e.target.value ? Number(e.target.value) : null })}
                  className={field}
                  aria-label="마일스톤"
                >
                  <option value="">선택 안 함</option>
                  {milestones.map((m) => (
                    <option key={m.milestoneId} value={m.milestoneId}>
                      🏁 {m.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        {/* 날짜 */}
        <div>
          <span className={labelText}>날짜</span>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['ON', '그날 하기'],
                ['DUE', '그날까지'],
                ['NONE', '날짜 없음'],
              ] as const
            ).map(([t, label]) => (
              <Chip key={t} size="sm" selected={f.dateType === t} onClick={() => setDateType(t)}>
                {label}
              </Chip>
            ))}
          </div>
          {f.dateType !== 'NONE' && (
            <input
              type="date"
              min={today}
              value={date ?? ''}
              onChange={(e) => setDate(e.target.value)}
              className={`${field} mt-2`}
              aria-label="날짜"
            />
          )}
          {f.dateType === 'NONE' && (
            <p className="text-ink-3 mt-2 text-xs">빈 시간이 있는 가까운 날에 알아서 배치해요.</p>
          )}
        </div>

        {f.dateType === 'ON' && (
          <div>
            <span className={labelText}>시간 (선택)</span>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="time"
                step={600}
                value={f.startTime ?? ''}
                onChange={(e) => set({ startTime: e.target.value || null })}
                className={field}
                aria-label="시작 시각"
              />
              <input
                type="time"
                step={600}
                value={f.endTime ?? ''}
                onChange={(e) => set({ endTime: e.target.value || null })}
                className={field}
                aria-label="종료 시각"
              />
            </div>
            <p className={timeInvalid ? 'text-danger mt-1 text-xs' : 'text-ink-3 mt-1 text-xs'}>
              {timeInvalid
                ? '종료 시각이 시작 시각보다 늦어야 해요.'
                : '시간을 정하면 그 시간에 고정(🔒)돼요. 비워 두면 AI가 빈 시간에 놓아요.'}
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={labelText}>예상 소요 시간</span>
            <select
              value={f.estimatedMinutes ?? 30}
              onChange={(e) => set({ estimatedMinutes: Number(e.target.value) })}
              className={field}
              aria-label="예상 소요 시간"
            >
              {[...new Set([...MINUTES, f.estimatedMinutes ?? 30])]
                .sort((a, b) => a - b)
                .map((m) => (
                  <option key={m} value={m}>
                    {m < 60 ? `${m}분` : m % 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m / 60}시간`}
                  </option>
                ))}
            </select>
          </label>
          <div>
            <span className={labelText}>중요도</span>
            <div className="flex gap-1">
              {PRIORITIES.map((p) => (
                <Chip
                  key={p}
                  size="sm"
                  selected={(f.priority ?? 'C') === p}
                  onClick={() => set({ priority: p })}
                  title={PRIORITY_HINT[p]}
                  aria-label={`중요도 ${p} ${PRIORITY_HINT[p]}`}
                  className="w-9 px-0"
                >
                  {p}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={f.kind === 'APPOINTMENT'}
            onChange={(e) => set({ kind: e.target.checked ? 'APPOINTMENT' : 'NORMAL' })}
            className="accent-brand size-4"
          />
          다른 사람과 정한 약속이에요 (중요도가 올라가요)
        </label>
      </div>
    </Modal>
  )
}
