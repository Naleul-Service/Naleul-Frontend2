'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Bell, SettingsIcon } from '@/components/icons'
import { Logo } from '@/components/brand/Logo'
import { GuestBanner } from '@/components/auth/LoginRequiredDialog'
import { GuestSessionTracker } from '@/components/analytics/GuestSessionTracker'
import { COMMON_EVENTS as CE, track } from '@/lib/client/analytics'
import { currentPath } from '@/lib/client/commonEvents'
import { iconButtonClass } from '@/components/ui/IconButton'
import { MobileTabBar } from './MobileTabBar'
import { Sidebar } from './Sidebar'

import { isGuestUser, type SessionUserView } from './types'

/**
 * 로그인 후 화면의 공통 틀.
 *  - lg(1024px) 이상: 왼쪽 고정 사이드바
 *  - 그보다 좁으면: 위 MobileHeader(워드마크 · 알림 · 설정) + 아래 MobileTabBar (예전 햄버거 서랍은 Figma 에 맞춰 없앴어요)
 */
export function AppShell({ user, children }: { user: SessionUserView; children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <GuestSessionTracker isGuest={isGuestUser(user)} />
      {/* 디자인 시스템 Sidebar — 240 · bg/surface · 오른쪽 1px border/subtle */}
      <aside className="border-border-subtle bg-bg-surface fixed inset-y-0 left-0 z-30 hidden w-60 border-r lg:block">
        <Sidebar user={user} />
      </aside>

      {/* 디자인 시스템 MobileHeader — h48 · 위에 고정 · 왼쪽 워드마크 / 오른쪽 알림 · 설정 */}
      <header className="border-border-soft bg-bg-surface sticky top-0 z-20 flex h-12 items-center gap-2 border-b px-5 lg:hidden">
        {/* 위쪽 바 로고는 링크가 아니에요 (사이드바 로고는 홈으로 감) → 눌러 보는지 확인 */}
        <span onClick={() => track(CE.mobileHeaderDeadClick, { dead_target: 'logo', current_path: currentPath() })}>
          <Logo />
        </span>
        <div className="ml-auto flex items-center gap-1 -mr-1.5">
          <Link href="/settings/notifications" aria-label="알림 설정" title="알림 설정" className={iconButtonClass('md')}>
            <Bell />
          </Link>
          <Link href="/settings" aria-label="설정" title="설정" className={iconButtonClass('md')}>
            <SettingsIcon />
          </Link>
        </div>
      </header>

      {/* 모바일: 아래 탭바만큼 비워요 (--tabbar-h) */}
      <main className="pb-(--tabbar-h) lg:pb-0 lg:pl-60">
        {isGuestUser(user) && <GuestBanner />}
        <div className="mx-auto w-full max-w-[1440px] px-5 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</div>
      </main>

      <MobileTabBar />
    </div>
  )
}
