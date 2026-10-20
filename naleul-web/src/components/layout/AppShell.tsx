'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Menu } from '@/components/icons'
import { Logo } from '@/components/brand/Logo'
import { GuestBanner } from '@/components/auth/LoginRequiredDialog'
import { GuestSessionTracker } from '@/components/analytics/GuestSessionTracker'
import { COMMON_EVENTS as CE, track } from '@/lib/client/analytics'
import { currentPath } from '@/lib/client/commonEvents'
import { cn } from '@/lib/cn'
import { iconButtonClass } from '@/components/ui/IconButton'
import { Sidebar } from './Sidebar'

const LG = 1024
const breakpoint = () => {
  const w = window.innerWidth
  return w >= 1536 ? '2xl' : w >= LG ? 'lg' : w >= 640 ? 'sm' : 'mobile'
}
import { isGuestUser, type SessionUserView } from './types'

/**
 * 로그인 후 화면의 공통 틀.
 *  - lg(1024px) 이상: 왼쪽 고정 사이드바
 *  - 그보다 좁으면: 상단 바 + 햄버거로 여는 서랍(drawer)
 */
export function AppShell({ user, children }: { user: SessionUserView; children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const openedAt = useRef(0)
  // 서랍 닫기 — 바깥(어두운 곳) 클릭 backdrop / 서랍 안 링크·버튼 navigate (X·Esc 는 없어요)
  const closeWith = (method: 'backdrop' | 'navigate') => {
    track(CE.drawerClose, {
      close_method: method,
      open_duration_seconds: Math.round((Date.now() - openedAt.current) / 1000),
    })
    setDrawerOpen(false)
  }
  const close = () => closeWith('navigate')

  // 서랍이 열린 채로 창을 lg 이상으로 넓히면 서랍만 숨겨지고 열린 상태는 남아요 (다시 좁히면 다시 나타남)
  useEffect(() => {
    if (!drawerOpen) return
    let wide = window.innerWidth >= LG
    const onResize = () => {
      const nowWide = window.innerWidth >= LG
      if (nowWide && !wide) track(CE.drawerResizeHidden, { layout_breakpoint: breakpoint() })
      wide = nowWide
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [drawerOpen])

  return (
    <div className="min-h-dvh">
      <GuestSessionTracker isGuest={isGuestUser(user)} />
      {/* 디자인 시스템 Sidebar — 240 · bg/surface · 오른쪽 1px border/subtle */}
      <aside className="border-border-subtle bg-bg-surface fixed inset-y-0 left-0 z-30 hidden w-60 border-r lg:block">
        <Sidebar user={user} />
      </aside>

      {/* 디자인 시스템 MobileHeader — h48 */}
      <header className="border-border-subtle bg-glass-bg sticky top-0 z-20 flex h-12 items-center gap-2 border-b px-4 backdrop-blur-[16px] lg:hidden">
        <button
          type="button"
          onClick={() => {
            track(CE.mobileHeaderMenuClick, { current_path: currentPath(), layout_breakpoint: breakpoint() })
            openedAt.current = Date.now()
            setDrawerOpen(true)
          }}
          aria-label="메뉴 열기"
          className={cn(iconButtonClass('md'), '-ml-1.5')}
        >
          <Menu className="size-5" />
        </button>
        {/* 위쪽 바 로고는 링크가 아니에요 (사이드바 로고는 홈으로 감) → 눌러 보는지 확인 */}
        <span onClick={() => track(CE.mobileHeaderDeadClick, { dead_target: 'logo', current_path: currentPath() })}>
          <Logo size="lg" />
        </span>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="bg-bg-overlay absolute inset-0 animate-[fade-in_150ms_ease-out]"
            onClick={() => closeWith('backdrop')}
            aria-hidden
          />
          <aside className="bg-bg-surface shadow-pop absolute inset-y-0 left-0 w-60 max-w-[85vw]">
            <Sidebar user={user} onNavigate={close} />
          </aside>
        </div>
      )}

      <main className="lg:pl-60">
        {isGuestUser(user) && <GuestBanner />}
        <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</div>
      </main>
    </div>
  )
}
