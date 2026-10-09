import { cn } from '@/lib/cn'

export function Logo({ className, size = 'md' }: { className?: string; size?: 'md' | 'lg' }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        className={cn(
          'bg-ink grid place-items-center rounded-[10px] font-bold text-on-ink',
          size === 'lg' ? 'size-11 text-lg' : 'size-8 text-[15px]'
        )}
      >
        나
      </span>
      <span className={cn('font-bold tracking-tight', size === 'lg' ? 'text-2xl' : 'text-lg')}>나를</span>
    </span>
  )
}
