import type { ButtonHTMLAttributes, Ref } from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'brand' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-on-ink hover:bg-ink/85',
  brand: 'bg-brand text-white hover:bg-brand-strong',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-subtle',
  ghost: 'bg-transparent text-ink-2 hover:bg-subtle',
  danger: 'bg-danger text-white hover:bg-danger/90',
}

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-lg gap-1.5',
  md: 'h-10 px-4 text-sm rounded-xl gap-2',
  lg: 'h-12 px-5 text-[15px] rounded-2xl gap-2',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
  ref?: Ref<HTMLButtonElement>
}

/** 클래스만 필요할 때 (예: <Link className={buttonClass('primary')}>) */
export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', fullWidth = false) {
  return cn(
    'inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-colors',
    'disabled:pointer-events-none disabled:opacity-40',
    VARIANT[variant],
    SIZE[size],
    fullWidth && 'w-full'
  )
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonClass(variant, size, fullWidth), className)}
      {...rest}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  )
}
