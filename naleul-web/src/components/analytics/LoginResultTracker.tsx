'use client'

import { useEffect } from 'react'
import { EVENTS, identifyUser, track, type AnalyticsUserRole } from '@/lib/client/analytics'
import { takeLoginAttempt, takeLoginResultCookie } from '@/lib/loginAnalytics'

const ROLES: AnalyticsUserRole[] = ['GUEST', 'FREE', 'PRO', 'ADMIN']
const toRole = (v?: string) => (ROLES.includes(v as AnalyticsUserRole) ? (v as AnalyticsUserRole) : undefined)

/**
 * login.complete 를 보내요. 화면에는 아무것도 그리지 않아요. (Providers 에 하나만)
 *
 * 카카오 · Apple 콜백(서버)은 성공하면 1회용 쿠키(naleul_login_result)를 심고 원래 화면으로 리다이렉트해요.
 * 그 첫 화면에서 쿠키를 읽고 바로 지운 뒤:
 *  1) identifyUser → setUserId. 둘러보기 중 이벤트(같은 deviceId)가 이 사용자에게 이어 붙어요
 *  2) login.complete 전송 (어느 화면 버튼이었는지는 시도 때 sessionStorage 에 저장한 값)
 * 순서가 중요해요: setUserId 를 먼저 해야 login.complete 가 로그인한 사용자에게 붙어요.
 */
export function LoginResultTracker() {
  useEffect(() => {
    const result = takeLoginResultCookie()
    if (!result) return
    const attempt = takeLoginAttempt()
    identifyUser({ userId: result.userId, role: toRole(result.userRole), provider: result.provider })
    track(EVENTS.loginComplete, {
      login_provider: result.provider,
      login_surface: attempt?.surface,
      is_new_user: result.isNewUser,
    })
  }, [])
  return null
}
