'use client'

import { cn } from '@/lib/cn'

interface SwitchProps {
  checked: boolean
  onChange: (next: boolean) => void
  /** 화면에 글자 라벨이 따로 있어도 스크린리더용으로 넣어주세요 */
  label: string
  disabled?: boolean
  className?: string
}

/** iOS Toggle 같은 켜기/끄기 스위치 */
export function Switch({ checked, onChange, label, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors',
        'disabled:pointer-events-none disabled:opacity-40',
        checked ? 'bg-brand' : 'bg-line-strong',
        className
      )}
    >
      <span
        className={cn(
          'inline-block size-6 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        )}
      />
    </button>
  )
}
