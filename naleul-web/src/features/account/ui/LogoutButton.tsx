'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { logout } from '@/lib/client/api'

/** 설정 · 로그아웃 (확인창 → 쿠키 삭제 → /login) */
export function LogoutButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <LogOut className="text-ink-3 size-[18px]" />
        <span className="text-ink-2 flex-1 text-[15px] font-semibold">로그아웃</span>
      </button>
      <ConfirmDialog
        open={open}
        title="정말 로그아웃 하시겠어요?"
        confirmLabel="로그아웃"
        tone="danger"
        loading={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setPending(true)
          logout()
        }}
      />
    </>
  )
}
