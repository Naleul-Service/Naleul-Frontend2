'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  CalendarDays,
  Home,
  Library,
  LogIn,
  LogOut,
  Plus,
  Settings,
  Target,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { logout } from '@/lib/client/api'
import { COMMON_EVENTS as CE, EVENTS, track } from '@/lib/client/analytics'
import { currentPath } from '@/lib/client/commonEvents'
import { Logo } from '@/components/brand/Logo'
import { buttonClass } from '@/components/ui/Button'
import { GoalNavList } from '@/features/goal/ui/GoalNavList'
import { AdSlot } from '@/components/ads/AdSlot'
import { openLoginDialog } from '@/components/auth/loginHref'
import { isGuestUser, type SessionUserView } from './types'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Amplitude nav_item */
  key: string
}

/** 넓은 화면 왼쪽 고정(sidebar) / 좁은 화면 ☰ 서랍(drawer) — 서랍일 때만 onNavigate 가 있어요 */
export type NavSurface = 'sidebar' | 'drawer'

const NAV: NavItem[] = [
  { href: '/', label: '홈', icon: Home, key: 'home' },
  { href: '/goal', label: '목표', icon: Target, key: 'goal' },
  { href: '/calendar', label: '캘린더', icon: CalendarDays, key: 'calendar' },
  { href: '/reflections', label: '회고 모아보기', icon: Library, key: 'reflections' },
  { href: '/patterns', label: '나의 패턴', icon: BarChart3, key: 'patterns' },
]

const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)

const PLAN_LABEL: Record<string, string> = { FREE: 'Free plan', PRO: 'Pro plan', ADMIN: 'Admin', GUEST: '로그인 전' }

function NavLink({
  item,
  pathname,
  onNavigate,
  surface,
}: {
  item: NavItem
  pathname: string
  onNavigate?: () => void
  surface: NavSurface
}) {
  const active = isActive(pathname, item.href)
  const Icon = item.icon
  return (
    <Link
      // 회고 모아보기는 들어온 길(reflections.pageview entry_source)을 주소에 붙여요
      href={item.key === 'reflections' ? `${item.href}?from=sidebar` : item.href}
      onClick={() => {
        track(CE.sidebarNavClick, {
          nav_item: item.key,
          nav_surface: surface,
          current_path: currentPath(),
          is_current: active,
        })
        onNavigate?.()
      }}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors',
        active ? 'bg-subtle text-ink font-bold' : 'text-ink-2 hover:bg-subtle/70 hover:text-ink'
      )}
    >
      <Icon className="size-[18px]" strokeWidth={active ? 2.4 : 2} />
      {item.label}
    </Link>
  )
}

export function Sidebar({ user, onNavigate }: { user: SessionUserView; onNavigate?: () => void }) {
  const pathname = usePathname()
  const surface: NavSurface = onNavigate ? 'drawer' : 'sidebar'
  const ev = { nav_surface: surface, current_path: currentPath() }

  return (
    <div className="flex h-full flex-col px-4 pt-6 pb-4">
      <Link
        href="/"
        onClick={() => {
          track(CE.sidebarLogoClick, { ...ev, current_path: currentPath(), is_current: pathname === '/' })
          onNavigate?.()
        }}
        className="px-2"
      >
        <Logo />
      </Link>

      {/* 캘린더를 보면서 추가하도록 캘린더 오른쪽 패널로 열어요 (/tasks/new 전체 화면도 그대로 있어요) */}
      <Link
        href="/calendar?add=ai"
        onClick={() => {
          track(CE.sidebarTaskAddClick, { ...ev, current_path: currentPath() })
          onNavigate?.()
        }}
        className={cn(buttonClass('primary', 'lg', true), 'mt-6')}
      >
        <Plus className="size-4" strokeWidth={2.6} />
        Task 추가
      </Link>

      <nav className="mt-6 flex flex-col gap-1" aria-label="주 메뉴">
        {NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} surface={surface} />
        ))}
      </nav>

      <section className="mt-8" aria-labelledby="my-goals-heading">
        <div className="flex items-center justify-between px-3">
          <h2
            id="my-goals-heading"
            onClick={() => track(CE.sidebarDeadClick, { dead_target: 'goals_heading', nav_surface: surface })}
            className="text-ink-3 text-[13px] font-medium"
          >
            내 목표
          </h2>
          <Link
            href="/goal/add"
            onClick={() => {
              track(CE.sidebarGoalAddClick, { ...ev, current_path: currentPath() })
              onNavigate?.()
            }}
            aria-label="목표 추가"
            className="text-ink-3 hover:bg-subtle hover:text-ink rounded-md p-1"
          >
            <Plus className="size-4" />
          </Link>
        </div>
        <GoalNavList onNavigate={onNavigate} surface={surface} />
      </section>

      <div className="mt-6">
        <NavLink
          item={{ href: '/settings', label: '설정', icon: Settings, key: 'settings' }}
          pathname={pathname}
          onNavigate={onNavigate}
          surface={surface}
        />
      </div>

      {/* 아래 프로필을 바닥으로 밀어요 (광고가 안 보일 때도) */}
      <div className="mt-auto" />
      <AdSlot placement="sidebar" role={user.role} className="mb-3" />

      {isGuestUser(user) ? (
        <div className="border-line border-t px-1 pt-4">
          <p className="text-ink-3 px-1 text-[13px]">둘러보는 중이에요. 로그인하면 만든 목표와 Task가 저장돼요.</p>
          <button
            type="button"
            onClick={() => {
              onNavigate?.() // 모바일 서랍은 닫고 모달을 띄워요
              track(EVENTS.sidebarGuestLoginClick)
              openLoginDialog({ reason: 'login', source: 'sidebar' })
            }}
            className={cn(buttonClass('primary', 'md', true), 'mt-3')}
          >
            <LogIn className="size-4" />
            로그인하고 시작하기
          </button>
        </div>
      ) : (
        <div className="border-line flex items-center gap-3 border-t px-2 pt-4">
          <span
            onClick={() => track(CE.sidebarDeadClick, { dead_target: 'avatar', nav_surface: surface })}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#8EA2FF] to-[#B49CFF] text-sm font-bold text-white"
          >
            {user.name.slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1">
            <p
              onClick={() => track(CE.sidebarDeadClick, { dead_target: 'profile_name', nav_surface: surface })}
              className="truncate text-[15px] font-bold"
            >
              {user.name}
            </p>
            <p
              onClick={() => track(CE.sidebarDeadClick, { dead_target: 'plan_label', nav_surface: surface })}
              className="text-ink-3 text-xs"
            >
              {PLAN_LABEL[user.role ?? 'FREE'] ?? 'Free plan'}
            </p>
          </div>
          <button
            type="button"
            // logout 을 그대로 넘기면 클릭 이벤트 객체가 trackEvent 자리에 들어가요 → 화살표 함수로 감싸요
            onClick={() => void logout(EVENTS.sidebarLogoutClick)}
            aria-label="로그아웃"
            title="로그아웃"
            className="text-ink-3 hover:bg-subtle hover:text-ink rounded-lg p-2"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}
