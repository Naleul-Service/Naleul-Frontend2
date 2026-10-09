'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, CalendarDays, Home, LogOut, Plus, Settings, Target, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { logout } from '@/lib/client/api'
import { Logo } from '@/components/brand/Logo'
import { buttonClass } from '@/components/ui/Button'
import { GoalNavList } from '@/features/goal/ui/GoalNavList'
import type { SessionUserView } from './types'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

const NAV: NavItem[] = [
  { href: '/', label: '홈', icon: Home },
  { href: '/goal', label: '목표', icon: Target },
  { href: '/calendar', label: '캘린더', icon: CalendarDays },
  { href: '/patterns', label: '나의 패턴', icon: BarChart3 },
]

const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)

const PLAN_LABEL: Record<string, string> = { FREE: 'Free plan', PRO: 'Pro plan', ADMIN: 'Admin' }

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const active = isActive(pathname, item.href)
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
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

  return (
    <div className="flex h-full flex-col px-4 pt-6 pb-4">
      <Link href="/" onClick={onNavigate} className="px-2">
        <Logo />
      </Link>

      {/* 캘린더를 보면서 추가하도록 캘린더 오른쪽 패널로 열어요 (/tasks/new 전체 화면도 그대로 있어요) */}
      <Link href="/calendar?add=ai" onClick={onNavigate} className={cn(buttonClass('primary', 'lg', true), 'mt-6')}>
        <Plus className="size-4" strokeWidth={2.6} />
        Task 추가
      </Link>

      <nav className="mt-6 flex flex-col gap-1" aria-label="주 메뉴">
        {NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </nav>

      <section className="mt-8" aria-labelledby="my-goals-heading">
        <div className="flex items-center justify-between px-3">
          <h2 id="my-goals-heading" className="text-ink-3 text-[13px] font-medium">
            내 목표
          </h2>
          <Link
            href="/goal/add"
            onClick={onNavigate}
            aria-label="목표 추가"
            className="text-ink-3 hover:bg-subtle hover:text-ink rounded-md p-1"
          >
            <Plus className="size-4" />
          </Link>
        </div>
        <GoalNavList onNavigate={onNavigate} />
      </section>

      <div className="mt-6">
        <NavLink
          item={{ href: '/settings', label: '설정', icon: Settings }}
          pathname={pathname}
          onNavigate={onNavigate}
        />
      </div>

      <div className="border-line mt-auto flex items-center gap-3 border-t px-2 pt-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#8EA2FF] to-[#B49CFF] text-sm font-bold text-white">
          {user.name.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold">{user.name}</p>
          <p className="text-ink-3 text-xs">{PLAN_LABEL[user.role ?? 'FREE'] ?? 'Free plan'}</p>
        </div>
        <button
          type="button"
          onClick={logout}
          aria-label="로그아웃"
          title="로그아웃"
          className="text-ink-3 hover:bg-subtle hover:text-ink rounded-lg p-2"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  )
}
