'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, CalendarRange, Infinity as InfinityIcon, X } from 'lucide-react'
import { Chip } from '@/components/ui/Chip'
import { cn } from '@/lib/cn'
import type { ChangeScope } from '../api'

export interface ScopeOption {
  scope: ChangeScope
  label: string
  hint: string
  /** 고를 수 없는 이유 (있으면 비활성) */
  disabledReason?: string
}

/**
 * 고를 수 있는 범위.
 * @param kind      루틴 / 고정 시간
 * @param sameDay   원래 날짜 그대로인지 (루틴을 다른 날로 옮기면 이날만)
 * @param crossesMidnight 새 시간이 자정을 넘기는지 (루틴 기본값은 자정을 넘길 수 없어요)
 */
export function scopeOptions({
  kind,
  isToday,
  sameDay = true,
  crossesMidnight = false,
}: {
  kind: 'routine' | 'fixed'
  isToday: boolean
  sameDay?: boolean
  crossesMidnight?: boolean
}): ScopeOption[] {
  const otherDay = kind === 'routine' && !sameDay ? '다른 날로 옮길 때는 이날만 바꿀 수 있어요' : undefined
  return [
    { scope: 'DAY', label: isToday ? '오늘만' : '이날만', hint: '이 하루만 바뀌어요' },
    {
      scope: 'WEEK',
      label: '이번 주',
      hint: '이날부터 이번 주 일요일까지',
      disabledReason: otherDay,
    },
    {
      scope: 'FOLLOWING',
      label: '앞으로 계속',
      hint: kind === 'routine' ? '남은 루틴 전부 + 루틴 기본 시간' : '기본 시간이 바뀌어요 (지난 기록은 그대로)',
      disabledReason:
        otherDay ??
        (kind === 'routine' && crossesMidnight ? '자정을 넘기는 시간은 루틴 기본값으로 정할 수 없어요' : undefined),
    },
  ]
}

const ICON = { DAY: CalendarDays, WEEK: CalendarRange, FOLLOWING: InfinityIcon } as const

/** 시간 직접 입력 창 안에서 쓰는 범위 고르기 (알약 버튼) */
export function ScopeChips({
  options,
  value,
  onChange,
}: {
  options: ScopeOption[]
  value: ChangeScope
  onChange: (s: ChangeScope) => void
}) {
  const current = options.find((o) => o.scope === value)
  return (
    <div>
      <span className="text-ink-3 mb-1 block text-xs font-medium">적용 범위</span>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="적용 범위">
        {options.map((o) => (
          <Chip
            key={o.scope}
            size="sm"
            role="radio"
            aria-checked={value === o.scope}
            selected={value === o.scope}
            disabled={!!o.disabledReason}
            title={o.disabledReason ?? o.hint}
            onClick={() => onChange(o.scope)}
          >
            {o.label}
          </Chip>
        ))}
      </div>
      <p className="text-ink-3 mt-1 text-xs">
        {options.find((o) => o.disabledReason)?.disabledReason ?? current?.hint}
      </p>
    </div>
  )
}

/**
 * 드래그로 루틴·고정 시간을 옮긴 직후 화면 아래에 뜨는 선택 바.
 * 1 / 2 / 3 키 또는 버튼으로 고르고, Enter = 첫 번째(이날만), Esc·X = 취소(원래 자리로).
 * 아무것도 고르지 않고 바깥을 누르거나 포커스가 빠져나가면 onDismiss (= "이날만"으로 저장).
 */
export function ScopeChooser({
  title,
  options,
  loading,
  onChoose,
  onCancel,
  onDismiss,
}: {
  title: string
  options: ScopeOption[]
  loading?: boolean
  onChoose: (s: ChangeScope) => void
  onCancel: () => void
  /** 고르지 않고 바깥을 누르거나 포커스가 빠져나감 (없으면 아무것도 안 함) */
  onDismiss?: () => void
}) {
  const firstRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  // 렌더마다 새 함수여도 키보드 핸들러가 최신 값을 쓰도록
  const latest = useRef({ options, onChoose, onCancel, onDismiss, loading })
  useEffect(() => {
    latest.current = { options, onChoose, onCancel, onDismiss, loading }
  })

  // 바깥 클릭 · 포커스 이동 → "이날만" (사용자가 그냥 다른 일을 하러 가면 바꾼 대로 두는 게 자연스러워요)
  useEffect(() => {
    const outside = (target: EventTarget | null) =>
      target instanceof Node && !!dialogRef.current && !dialogRef.current.contains(target)
    const onPointerDown = (e: PointerEvent) => {
      // 다른 블록을 끌려고 누른 경우도 여기서 먼저 "이날만"으로 저장돼요
      if (outside(e.target) && !latest.current.loading) latest.current.onDismiss?.()
    }
    const onFocusIn = (e: FocusEvent) => {
      if (outside(e.target) && !latest.current.loading) latest.current.onDismiss?.()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('focusin', onFocusIn)
    }
  }, [])

  useEffect(() => {
    firstRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      const { options: opts, onChoose: choose, onCancel: cancel, loading: busy } = latest.current
      if (busy) return
      if (e.key === 'Escape') {
        e.preventDefault()
        cancel()
      } else if (['1', '2', '3'].includes(e.key)) {
        const o = opts[Number(e.key) - 1]
        if (o && !o.disabledReason) choose(o.scope)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-label="적용 범위 고르기"
        className="bg-surface shadow-pop border-line pointer-events-auto w-full max-w-[560px] animate-[modal-in_160ms_ease-out] rounded-2xl border p-4"
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold">{title}</p>
            <p className="text-ink-3 mt-0.5 text-xs">어디까지 바꿀까요?</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            aria-label="취소하고 원래대로"
            className="text-ink-3 hover:bg-subtle hover:text-ink -mt-1 -mr-1 rounded-lg p-1.5"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {options.map((o, i) => {
            const Icon = ICON[o.scope]
            return (
              <button
                key={o.scope}
                ref={i === 0 ? firstRef : undefined}
                type="button"
                disabled={!!o.disabledReason || loading}
                title={o.disabledReason}
                onClick={() => onChoose(o.scope)}
                className={cn(
                  'border-line-strong hover:border-brand hover:bg-brand-soft focus-visible:border-brand focus-visible:bg-brand-soft flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors outline-none',
                  'disabled:hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent'
                )}
              >
                <span className="flex w-full items-center gap-1.5 text-[14px] font-bold">
                  <Icon className="text-brand size-4" />
                  {o.label}
                  <kbd className="text-ink-4 ml-auto hidden text-[10px] font-medium sm:inline">{i + 1}</kbd>
                </span>
                <span className="text-ink-3 text-[11px] leading-snug">{o.disabledReason ?? o.hint}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}
