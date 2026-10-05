/**
 * 로그인 쿠키 관련 상수/헬퍼.
 * proxy.ts 에서도 import 하므로 'server-only' 와 next/headers 를 쓰지 않아요.
 *
 * 쿠키를 쓰는 곳은 두 종류예요.
 *  1) Route Handler / Server Action 의 `await cookies()`
 *  2) NextResponse 의 `response.cookies`
 * 둘 다 set/delete 메서드를 가지고 있어서 아래 CookieWriter 하나로 받아요.
 */
import { secondsUntilExp } from '@/lib/jwt'

export const COOKIE = {
  access: 'accessToken',
  refresh: 'refreshToken',
  userId: 'userId',
  userName: 'userName',
  userRole: 'userRole',
} as const

export type UserRole = 'FREE' | 'PRO' | 'ADMIN'

interface CookieOptions {
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'lax' | 'strict' | 'none'
  path?: string
  maxAge?: number
}

export interface CookieWriter {
  set(name: string, value: string, options?: CookieOptions): unknown
  delete(name: string): unknown
}

const ACCESS_FALLBACK_SEC = 60 * 60 * 24 // 백엔드 access 만료 86400000ms = 24시간
const REFRESH_FALLBACK_SEC = 60 * 60 * 24 * 14 // refresh 만료를 못 읽을 때 기본 14일

function baseOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: true, // JS 에서 읽을 수 없게 → XSS 로 토큰 탈취 방지
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  }
}

export interface SessionTokens {
  accessToken: string
  refreshToken?: string // 재발급 시 새로 안 주면 undefined → 기존 것 유지
}

export interface SessionUser {
  userId?: number | string
  userName?: string
  userRole?: UserRole
}

/** 토큰 쿠키 저장. 쿠키 수명을 토큰 실제 만료 시각에 맞춰요. */
export function setTokenCookies(writer: CookieWriter, tokens: SessionTokens) {
  writer.set(COOKIE.access, tokens.accessToken, baseOptions(secondsUntilExp(tokens.accessToken, ACCESS_FALLBACK_SEC)))
  if (tokens.refreshToken) {
    writer.set(
      COOKIE.refresh,
      tokens.refreshToken,
      baseOptions(secondsUntilExp(tokens.refreshToken, REFRESH_FALLBACK_SEC))
    )
  }
}

/** 사이드바 표시용 사용자 정보. 서버 컴포넌트에서만 읽으므로 httpOnly 로 둬요. */
export function setUserCookies(writer: CookieWriter, user: SessionUser, refreshToken?: string) {
  const maxAge = refreshToken ? secondsUntilExp(refreshToken, REFRESH_FALLBACK_SEC) : REFRESH_FALLBACK_SEC
  const opts = baseOptions(maxAge)
  if (user.userId !== undefined && user.userId !== null) writer.set(COOKIE.userId, String(user.userId), opts)
  if (user.userName) writer.set(COOKIE.userName, user.userName, opts)
  if (user.userRole) writer.set(COOKIE.userRole, user.userRole, opts)
}

export function clearSessionCookies(writer: CookieWriter) {
  Object.values(COOKIE).forEach((name) => writer.delete(name))
}
