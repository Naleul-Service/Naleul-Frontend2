'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useHabitHome } from '@/features/habit/api'
import { useGoalCategories } from '../api'
import { goalColor, isOngoing } from '../format'

/** 사이드바 "내 목표" 목록 (진행 중 + 시작 전) */
export function GoalNavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { data, isPending, isError } = useGoalCategories()
  const goals = (data ?? []).filter((g) => isOngoing(g.goalCategoryStatus))
  // 기본 생활 습관 (V52) — 목표 목록 API 에는 안 나와서 따로 불러와요
  const habit = useHabitHome()
  const habitHref = habit.data ? `/goal/${habit.data.goalCategoryId}` : null
  const habitDue = habit.data?.habits.filter((h) => h.status === 'ACTIVE' && h.scheduled) ?? []
  const habitLeft = habitDue.filter((h) => !h.checked).length
  const habitLink = habitHref && (
    <li>
      <Link
        href={habitHref}
        onClick={onNavigate}
        aria-current={pathname === habitHref ? 'page' : undefined}
        className={cn(
          'flex h-10 items-center gap-2.5 rounded-xl px-3 text-[14px] transition-colors',
          pathname === habitHref ? 'bg-subtle font-bold' : 'hover:bg-subtle/70'
        )}
      >
        <span className="w-2.5 shrink-0 text-center text-[12px]" aria-hidden>
          {habit.data?.emoji ?? '🌱'}
        </span>
        <span className="min-w-0 flex-1 truncate">{habit.data?.goalName}</span>
        {habitDue.length > 0 && (
          <span className={cn('text-xs tabular-nums', habitLeft ? 'text-ink-3' : 'text-success font-semibold')}>
            {habitLeft ? `${habitLeft}개 남음` : '완료'}
          </span>
        )}
      </Link>
    </li>
  )

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
      <>
        {habitLink && <ul className="mt-1.5">{habitLink}</ul>}
        <Link
          href="/goal/add"
          onClick={onNavigate}
          className="text-brand hover:bg-brand-soft mt-2 flex h-9 items-center gap-2 rounded-xl px-3 text-[14px] font-semibold"
        >
          <Sparkles className="size-4" />
          {isError ? '목표 불러오기 실패 · 새로 만들기' : '첫 목표 만들기'}
        </Link>
      </>
    )
  }

  return (
    <ul className="mt-1.5 space-y-0.5">
      {habitLink}
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
                <span className="text-warning-ink text-xs">임시</span>
              ) : g.goalMode === 'RECORD' ? (
                <span className="text-ink-3 text-xs">업무</span>
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
