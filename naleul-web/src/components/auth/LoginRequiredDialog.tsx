'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { buttonClass } from '@/components/ui/Button'
import { LOGIN_REQUIRED_EVENT } from '@/lib/client/api'
import { safeRedirectPath } from '@/lib/redirectPath'
import { KakaoLoginButton } from './KakaoLoginButton'
import { AppleLoginButton } from './AppleLoginButton'
import { LOGIN_ERROR_PARAM, loginErrorMessage } from './kakaoAuth'
import { currentPath, openLoginDialog, type LoginDialogDetail, type LoginDialogReason } from './loginHref'

const COPY: Record<LoginDialogReason, { title: string; description: string }> = {
  save: {
    title: '로그인하고 저장해요',
    description: '지금은 둘러보는 중이에요. 로그인하면 만든 목표와 Task가 저장되고, 웹과 앱 어디서든 이어서 쓸 수 있어요.',
  },
  login: {
    title: '나를 시작하기',
    description: '카카오나 Apple로 바로 시작해요. 로그인하면 만든 목표와 Task가 저장되고, 웹과 앱 어디서든 이어서 쓸 수 있어요.',
  },
}

interface DialogState {
  open: boolean
  reason: LoginDialogReason
  next: string
  error: string | null
}

/**
 * 로그인 모달 — 별도 로그인 페이지로 보내지 않고, 이 창 안에서 바로 카카오 로그인을 시작해요.
 * 로그인이 끝나면 지금 보던 화면으로 돌아와요.
 *
 * 여는 방법
 *  1) 둘러보기 중 저장 → lib/client/api 가 401 GUEST_LOGIN_REQUIRED 를 받으면 LOGIN_REQUIRED_EVENT 를 보내요
 *  2) openLoginDialog() 를 직접 호출 (배너 · 사이드바의 로그인 버튼)
 *  3) 카카오 콜백이 실패하면 ?loginError=... 를 붙여 돌려보내요 → 들어오자마자 에러와 함께 열려요
 *
 * 앱 맨 위(Providers)에 하나만 두어서, 사이드바가 없는 목표 만들기 화면에서도 떠요.
 */
export function LoginRequiredDialog() {
  const [state, setState] = useState<DialogState>({ open: false, reason: 'save', next: '/', error: null })

  useEffect(() => {
    const onRequired = (e: Event) => {
      const detail = (e as CustomEvent<LoginDialogDetail | undefined>).detail
      setState({
        open: true,
        reason: detail?.reason ?? 'save',
        next: safeRedirectPath(currentPath()),
        error: loginErrorMessage(detail?.error),
      })
    }
    window.addEventListener(LOGIN_REQUIRED_EVENT, onRequired)

    // 카카오 로그인 실패로 돌아온 경우: 주소에서 loginError 를 지우고 에러와 함께 모달을 다시 열어요
    const url = new URL(window.location.href)
    const error = url.searchParams.get(LOGIN_ERROR_PARAM)
    if (error) {
      url.searchParams.delete(LOGIN_ERROR_PARAM)
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
      openLoginDialog({ reason: 'login', error })
    }

    return () => window.removeEventListener(LOGIN_REQUIRED_EVENT, onRequired)
  }, [])

  const close = () => setState((s) => ({ ...s, open: false }))
  const copy = COPY[state.reason]

  return (
    <Modal
      open={state.open}
      onClose={close}
      size="sm"
      title={copy.title}
      description={copy.description}
      footer={
        <div className="flex w-full flex-col gap-2">
          <KakaoLoginButton next={state.next} />
          <AppleLoginButton next={state.next} />
          <button type="button" onClick={close} className={buttonClass('ghost', 'md', true)}>
            계속 둘러보기
          </button>
        </div>
      }
    >
      {state.error && (
        <p role="alert" className="bg-danger-soft text-danger rounded-xl px-4 py-3 text-sm font-medium">
          {state.error}
        </p>
      )}
    </Modal>
  )
}

/** 둘러보기 중임을 알려주는 얇은 띠 (화면 맨 위) */
export function GuestBanner() {
  return (
    <div className="bg-brand-soft text-brand flex items-center justify-center gap-3 px-4 py-2 text-[13px] font-semibold">
      <span>둘러보는 중이에요 · 로그인하면 내 목표와 계획이 저장돼요</span>
      <button
        type="button"
        onClick={() => openLoginDialog({ reason: 'login' })}
        className="bg-brand rounded-full px-3 py-1 text-[12px] text-white hover:opacity-90"
      >
        로그인
      </button>
    </div>
  )
}
