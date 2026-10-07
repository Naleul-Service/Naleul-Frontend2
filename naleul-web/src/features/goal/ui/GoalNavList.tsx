'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useGoalCategories } from '../api'
import { goalColor, isOngoing } from '../format'

/** 사이드바 "내 목표" 목록 (진행 중 + 시작 전) */
export function GoalNavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { data, isPending, isError } = useGoalCategories()
  const goals = (data ?? []).filter((g) => isOngoing(g.goalCategoryStatus))

  if (isPending) {
    return (
      <div className="mt-2 space-y-2 px-3" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-subtle h-5 animate-pulse rounded-md" />
        ))}
      </div>
    )
  }

  if (isError || goals.length === 0) {
    return (
      <Link
        href="/goal/add"
        onClick={onNavigate}
        className="text-brand hover:bg-brand-soft mt-2 flex h-9 items-center gap-2 rounded-xl px-3 text-[14px] font-semibold"
      >
        <Sparkles className="size-4" />
        {isError ? '목표 불러오기 실패 · 새로 만들기' : '첫 목표 만들기'}
      </Link>
    )
  }

  return (
    <ul className="mt-1.5 space-y-0.5">
      {goals.map((g) => {
        const href = `/goal/${g.goalCategoryId}`
        const active = pathname === href
        const notStarted = g.goalCategoryStatus === 'NOT_STARTED'
        return (
          <li key={g.goalCategoryId}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-10 items-center gap-2.5 rounded-xl px-3 text-[14px] transition-colors',
                active ? 'bg-subtle font-bold' : 'hover:bg-subtle/70'
              )}
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: goalColor(g.colorCode) }} />
              <span className="min-w-0 flex-1 truncate">
                {g.emoji ? `${g.emoji} ` : ''}
                {g.goalCategoryName}
              </span>
              {g.temporary ? (
                <span className="text-xs text-[#b45309]">임시</span>
              ) : g.goalMode === 'RECORD' ? (
                <span className="text-ink-3 text-xs">기록</span>
              ) : (
                notStarted && <span className="text-ink-3 text-xs">시작 전</span>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
