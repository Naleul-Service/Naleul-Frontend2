'use client'

import { useState, type ReactNode } from 'react'
import { Menu } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { Sidebar } from './Sidebar'
import type { SessionUserView } from './types'

/**
 * 로그인 후 화면의 공통 틀.
 *  - lg(1024px) 이상: 왼쪽 고정 사이드바
 *  - 그보다 좁으면: 상단 바 + 햄버거로 여는 서랍(drawer)
 */
export function AppShell({ user, children }: { user: SessionUserView; children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const close = () => setDrawerOpen(false)

  return (
    <div className="min-h-dvh">
      <aside className="border-line bg-surface fixed inset-y-0 left-0 z-30 hidden w-[272px] border-r lg:block">
        <Sidebar user={user} />
      </aside>

      <header className="border-line bg-surface/90 sticky top-0 z-20 flex h-14 items-center gap-2 border-b px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="메뉴 열기"
          className="hover:bg-subtle -ml-2 rounded-lg p-2"
        >
          <Menu className="size-5" />
        </button>
        <Logo />
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 animate-[fade-in_150ms_ease-out] bg-black/40" onClick={close} aria-hidden />
          <aside className="bg-surface shadow-pop absolute inset-y-0 left-0 w-[280px] max-w-[85vw]">
            <Sidebar user={user} onNavigate={close} />
          </aside>
        </div>
      )}

      <main className="lg:pl-[272px]">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</div>
      </main>
    </div>
  )
}
