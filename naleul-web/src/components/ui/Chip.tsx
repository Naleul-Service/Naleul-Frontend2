import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
  size?: 'sm' | 'md'
}

/** 선택 가능한 알약 모양 버튼 (quickReplies, 요일 선택, 성향 선택 등) */
export function Chip({ selected = false, size = 'md', className, children, type = 'button', ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'inline-flex items-center justify-center rounded-full border font-medium transition-colors',
        'disabled:pointer-events-none disabled:opacity-40',
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        selected
          ? 'border-brand bg-brand text-white'
          : 'border-line-strong bg-surface text-ink-2 hover:border-ink-4 hover:text-ink',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

type BadgeTone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral'

const BADGE_TONE: Record<BadgeTone, string> = {
  brand: 'bg-brand-soft text-brand',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning-ink',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-subtle text-ink-2',
}

/** 클릭 안 되는 작은 라벨 ("AI가 설계한 목표", "루틴", "Task" 등) */
export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-semibold',
        BADGE_TONE[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
