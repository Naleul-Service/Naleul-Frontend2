'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { COMMON_EVENTS as CE, track } from '@/lib/client/analytics'
import { isApiError } from '@/lib/client/api'
import { currentPath } from '@/lib/client/commonEvents'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useHabitHome } from '@/features/habit/api'
import { useGoalCategories } from '../api'
import { goalColor, isOngoing } from '../format'

/** 사이드바 "내 목표" 목록 (진행 중 + 시작 전) */
/** 목표 목록 실패는 화면 이동마다 다시 보일 수 있어서 세션(탭)당 1회만 */
const LOAD_FAIL_KEY = 'naleul.sidebar_goal_fail_sent'

export function GoalNavList({
  onNavigate,
  surface = 'sidebar',
}: {
  onNavigate?: () => void
  /** 넓은 화면 고정 사이드바 / 좁은 화면 서랍 (Amplitude nav_surface) */
  surface?: 'sidebar' | 'drawer'
}) {
  const pathname = usePathname()
  const { data, isPending, isError, error } = useGoalCategories()
  useEffect(() => {
    if (!isError) return
    try {
      if (sessionStorage.getItem(LOAD_FAIL_KEY)) return
      sessionStorage.setItem(LOAD_FAIL_KEY, '1')
    } catch {
      // 저장이 막히면 그냥 보내요
    }
    track(CE.sidebarGoalListLoadFail, {
      error_status: isApiError(error) ? error.httpStatus : undefined,
      current_path: currentPath(),
    })
  }, [isError, error])
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
        onClick={() => {
          track(CE.sidebarHabitItemClick, {
            goal_category_id: habit.data?.goalCategoryId,
            habit_left_count: habitDue.length ? habitLeft : undefined,
            nav_surface: surface,
            is_current: pathname === habitHref,
          })
          onNavigate?.()
        }}
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
          onClick={() => {
            track(CE.sidebarGoalEmptyClick, { goal_list_state: isError ? 'error' : 'empty', nav_surface: surface })
            onNavigate?.()
          }}
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
      {goals.map((g, i) => {
        const href = `/goal/${g.goalCategoryId}`
        const active = pathname === href
        const notStarted = g.goalCategoryStatus === 'NOT_STARTED'
        return (
          <li key={g.goalCategoryId}>
            <Link
              href={href}
              onClick={() => {
                track(CE.sidebarGoalItemClick, {
                  goal_category_id: g.goalCategoryId,
                  goal_mode: g.goalMode,
                  goal_status: g.goalCategoryStatus,
                  is_temporary: !!g.temporary,
                  list_position: i,
                  nav_surface: surface,
                  is_current: active,
                })
                onNavigate?.()
              }}
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
