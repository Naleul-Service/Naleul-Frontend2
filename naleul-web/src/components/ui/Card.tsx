import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-card border-line bg-surface shadow-card border', className)} {...rest} />
}

export function CardHeader({
  title,
  aside,
  className,
}: {
  title: React.ReactNode
  aside?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <h2 className="text-[17px] font-bold">{title}</h2>
      {aside && <div className="text-ink-3 text-[13px]">{aside}</div>}
    </div>
  )
}
