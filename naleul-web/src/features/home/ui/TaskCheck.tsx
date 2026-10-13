'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

/** 동그란 완료 체크 — 홈의 Task · 루틴 · 습관 공통 */
export function TaskCheck({
  done,
  label,
  onToggle,
  disabled,
  size = 'md',
}: {
  done: boolean
  label: string
  onToggle: () => void
  disabled?: boolean
  size?: 'sm' | 'md'
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={done}
      aria-label={`${label} ${done ? '완료 취소' : '완료'}`}
      className={cn(
        'grid shrink-0 place-items-center rounded-full border-2 transition-colors disabled:opacity-50',
        size === 'sm' ? 'size-5' : 'size-6',
        done ? 'border-success bg-success text-white' : 'border-line-strong hover:border-success text-transparent'
      )}
    >
      <Check className={size === 'sm' ? 'size-3' : 'size-3.5'} strokeWidth={3.5} />
    </button>
  )
}
