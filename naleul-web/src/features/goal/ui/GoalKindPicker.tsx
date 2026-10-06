'use client'

import { useState } from 'react'
import { Chip } from '@/components/ui/Chip'
import { cn } from '@/lib/cn'
import { GOAL_TYPES, KIND_LABEL_MAX, subOption, type GoalKindValue, type GoalSubType, type GoalType } from '../kind'

/**
 * 목표 카테고리 2단계 선택 (명세 6.A.1.2).
 *
 * 1단계 카드(건강 / 학습·자기개발 / 생활습관 / 기타) → 2단계 칩 → "기타"면 이름 직접 입력(10자).
 * 1단계 "기타"는 2단계 없이 바로 이름을 적어요.
 * value 는 2단계까지 고른 뒤에만 채워지고, 고르는 중에는 null 이에요 (isKindComplete 로 "기타 이름"까지 확인).
 */
export function GoalKindPicker({
  value,
  onChange,
  disabled,
  compact = false,
}: {
  value: GoalKindValue | null
  onChange: (v: GoalKindValue | null) => void
  disabled?: boolean
  /** 목표 헤더 수정처럼 좁은 곳 — 1단계를 칩으로 */
  compact?: boolean
}) {
  // 1단계만 고르고 2단계는 아직인 상태
  const [pendingType, setPendingType] = useState<GoalType | null>(value?.goalType ?? null)
  const activeType = value?.goalType ?? pendingType
  const type = GOAL_TYPES.find((t) => t.value === activeType)

  const pickType = (t: GoalType) => {
    setPendingType(t)
    const opt = GOAL_TYPES.find((o) => o.value === t)!
    // 2단계가 "기타" 하나뿐(1단계 기타)이면 바로 그걸로
    if (opt.subs.length === 1) onChange({ goalType: t, goalSubType: opt.subs[0].value, goalKindLabel: '' })
    else onChange(null)
  }

  const pickSub = (s: GoalSubType) => {
    onChange({
      goalType: activeType!,
      goalSubType: s,
      goalKindLabel: subOption(s).custom ? (value?.goalKindLabel ?? '') : undefined,
    })
  }

  const custom = value && subOption(value.goalSubType)?.custom
  const label = value?.goalKindLabel ?? ''

  return (
    <div className="space-y-3">
      {compact ? (
        <div className="flex flex-wrap gap-1.5">
          {GOAL_TYPES.map((t) => (
            <Chip
              key={t.value}
              size="sm"
              selected={activeType === t.value}
              onClick={() => pickType(t.value)}
              disabled={disabled}
            >
              {t.emoji} {t.label}
            </Chip>
          ))}
        </div>
      ) : (
        <div role="radiogroup" aria-label="목표 카테고리" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {GOAL_TYPES.map((t) => {
            const selected = activeType === t.value
            return (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => pickType(t.value)}
                className={cn(
                  'flex flex-col items-start rounded-2xl border px-4 py-3 text-left transition-colors disabled:opacity-40',
                  selected ? 'border-brand bg-brand-soft' : 'border-line-strong bg-surface hover:border-ink-4'
                )}
              >
                <span className="text-[22px] leading-none">{t.emoji}</span>
                <span className={cn('mt-2 text-[15px] font-bold', selected && 'text-brand')}>{t.label}</span>
                <span className="text-ink-3 mt-0.5 text-[12px]">{t.hint}</span>
              </button>
            )
          })}
        </div>
      )}

      {type && type.subs.length > 1 && (
        <div role="radiogroup" aria-label={`${type.label} 세부 카테고리`} className="flex flex-wrap gap-2">
          {type.subs.map((s) => (
            <Chip
              key={s.value}
              size={compact ? 'sm' : 'md'}
              selected={value?.goalSubType === s.value}
              onClick={() => pickSub(s.value)}
              disabled={disabled}
              role="radio"
              aria-checked={value?.goalSubType === s.value}
            >
              <span className="mr-1">{s.emoji}</span>
              {s.label}
            </Chip>
          ))}
        </div>
      )}

      {custom && (
        <div className="relative max-w-[320px]">
          <input
            value={label}
            maxLength={KIND_LABEL_MAX}
            autoFocus
            disabled={disabled}
            onChange={(e) => onChange({ ...value!, goalKindLabel: e.target.value })}
            placeholder={
              type?.value === 'ETC' ? '예) 악기 연습' : type?.value === 'HEALTH' ? '예) 필라테스' : '예) 주식 공부'
            }
            aria-label="카테고리 이름 직접 입력"
            className="border-line-strong bg-surface placeholder:text-ink-4 focus:border-ink-3 h-10 w-full rounded-xl border pr-14 pl-3 text-[14px] outline-none"
          />
          <span className="text-ink-4 absolute top-1/2 right-3 -translate-y-1/2 text-[12px] tabular-nums">
            {label.length}/{KIND_LABEL_MAX}
          </span>
        </div>
      )}
    </div>
  )
}
