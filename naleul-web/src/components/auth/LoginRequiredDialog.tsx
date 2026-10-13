'use client'

import { useEffect, useState } from 'react'
import { LogIn } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { buttonClass } from '@/components/ui/Button'
import { LOGIN_REQUIRED_EVENT } from '@/lib/client/api'
import { loginHref } from './loginHref'

/**
 * 둘러보기 중에 저장(Task · 목표 추가 등)하려고 하면 뜨는 안내.
 * lib/client/api 가 401 GUEST_LOGIN_REQUIRED 를 받으면 LOGIN_REQUIRED_EVENT 를 보내요.
 */
export function LoginRequiredDialog() {
  const [open, setOpen] = useState(false)
  const [href, setHref] = useState('/login')

  useEffect(() => {
    const onRequired = () => {
      setHref(loginHref())
      setOpen(true)
    }
    window.addEventListener(LOGIN_REQUIRED_EVENT, onRequired)
    return () => window.removeEventListener(LOGIN_REQUIRED_EVENT, onRequired)
  }, [])

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      size="sm"
      title="로그인하고 저장해요"
      description="지금은 둘러보는 중이에요. 로그인하면 만든 목표와 Task가 저장되고, 웹과 앱 어디서든 이어서 쓸 수 있어요."
      footer={
        <div className="flex w-full flex-col gap-2">
          <a href={href} className={buttonClass('primary', 'lg', true)}>
            <LogIn className="size-4" />
            로그인하기
          </a>
          <button type="button" onClick={() => setOpen(false)} className={buttonClass('ghost', 'md', true)}>
            계속 둘러보기
          </button>
        </div>
      }
    />
  )
}

/** 둘러보기 중임을 알려주는 얇은 띠 (화면 맨 위) */
export function GuestBanner() {
  return (
    <div className="bg-brand-soft text-brand flex items-center justify-center gap-3 px-4 py-2 text-[13px] font-semibold">
      <span>둘러보는 중이에요 · 로그인하면 내 목표와 계획이 저장돼요</span>
      <a
        href="/login"
        onClick={(e) => {
          // 지금 보던 화면으로 돌아오게
          e.preventDefault()
          window.location.href = loginHref()
        }}
        className="bg-brand rounded-full px-3 py-1 text-[12px] text-white hover:opacity-90"
      >
        로그인
      </a>
    </div>
  )
}
