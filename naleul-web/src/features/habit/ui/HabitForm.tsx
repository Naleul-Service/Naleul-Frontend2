'use client'

import { useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { DaysPicker, Field, InlineForm, inlineInput } from '@/features/goal/edit/inline'
import { JAVA_DAYS } from '@/features/goal/format'
import type { JavaDayOfWeek } from '@/features/goal/api'
import type { Habit, HabitInput } from '../api'

/** 빠르게 고를 수 있는 기본 습관 — 누르면 바로 추가돼요 */
export const HABIT_SUGGESTIONS: { emoji: string; name: string; repeatDays?: JavaDayOfWeek[] }[] = [
  { emoji: '💊', name: '영양제 먹기' },
  { emoji: '💧', name: '물 2L 마시기' },
  { emoji: '🚿', name: '샤워하기' },
  { emoji: '🧹', name: '집안일 하기' },
  { emoji: '🦷', name: '치실하기' },
  { emoji: '📓', name: '일기 쓰기' },
  { emoji: '🧘', name: '스트레칭 5분' },
  { emoji: '🚭', name: '금연 지키기' },
  { emoji: '🍺', name: '금주 지키기' },
  { emoji: '🥗', name: '식단 지키기' },
  { emoji: '🌙', name: '자정 전에 자기' },
  { emoji: '🗑️', name: '분리수거', repeatDays: ['WEDNESDAY', 'SUNDAY'] },
]

/**
 * 습관 추가 · 수정 폼. 반복 요일을 하나도 안 고르면 매일, 알림 시각은 선택.
 * Enter 로 저장, Esc 로 닫기.
 */
export function HabitForm({
  initial,
  saving,
  onSubmit,
  onCancel,
  submitLabel,
  extra,
}: {
  initial?: Habit
  saving: boolean
  onSubmit: (v: HabitInput & { name: string }) => void
  onCancel: () => void
  submitLabel: string
  extra?: React.ReactNode
}) {
  const [emoji, setEmoji] = useState(initial?.emoji ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  // 매일이면 화면에선 7일 모두 켠 상태로 보여줘요 (DaysPicker 의 "매일" 칩이 켜지게)
  const [days, setDays] = useState<JavaDayOfWeek[]>(initial && !initial.daily ? initial.repeatDays : [...JAVA_DAYS])
  const [remind, setRemind] = useState(initial?.remindTime ?? '')
  const value = name.trim()
  const error = days.length === 0 ? '요일을 하나 이상 골라 주세요.' : null

  const submit = () =>
    onSubmit({
      name: value,
      emoji: emoji.trim(),
      repeatDays: days.length === 7 ? [] : days,
      ...(remind ? { remindTime: remind } : initial?.remindTime ? { clearRemindTime: true } : {}),
    })

  return (
    <InlineForm
      onSubmit={submit}
      onCancel={onCancel}
      saving={saving}
      valid={!!value && !error}
      error={value ? error : null}
      submitLabel={submitLabel}
      extra={extra}
    >
      <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-2">
        <Field label="이모지">
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={16}
            placeholder="✅"
            className={`${inlineInput} text-center placeholder:opacity-40`}
          />
        </Field>
        <Field label="습관">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            placeholder="예: 영양제 먹기"
            className={inlineInput}
            data-autofocus
          />
        </Field>
      </div>
      <div>
        <span className="text-ink-3 mb-1 block text-[12px] font-medium">언제 하나요?</span>
        <DaysPicker value={days} onChange={setDays} />
      </div>
      <div>
        <span className="text-ink-3 mb-1 block text-[12px] font-medium">알림 (선택)</span>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Bell className="text-ink-3 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              type="time"
              value={remind}
              onChange={(e) => setRemind(e.target.value)}
              aria-label="알림 시각"
              className={`${inlineInput} w-[150px] pl-9`}
            />
          </div>
          {remind && (
            <button
              type="button"
              onClick={() => setRemind('')}
              className="text-ink-3 hover:text-ink flex items-center gap-1 text-[13px] font-medium"
            >
              <BellOff className="size-3.5" />
              알림 끄기
            </button>
          )}
        </div>
        <p className="text-ink-4 mt-1 text-[12px]">그 시각까지 체크하지 않았을 때만 앱으로 알려드려요.</p>
      </div>
    </InlineForm>
  )
}
