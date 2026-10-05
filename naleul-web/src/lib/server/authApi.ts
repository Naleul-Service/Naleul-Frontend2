/**
 * 백엔드 인증 API 호출 (로그인 / 토큰 재발급).
 * proxy.ts 에서도 쓰므로 'server-only' 를 넣지 않았어요. (브라우저에서 import 하지 마세요)
 */
import type { ApiEnvelope } from '@/types/api'
import { BACKEND_PATHS, backendUrl } from './backendPaths'
import type { SessionTokens, UserRole } from './session'

const stripBearer = (v: string | null) => v?.replace(/^Bearer\s+/i, '').trim() || undefined

/**
 * 같은 refreshToken 으로 동시에 여러 번 재발급하지 않도록 묶어요.
 * (화면 하나에서 API 3개가 동시에 401을 받으면 재발급도 3번 나가는 문제 방지)
 * 서버 인스턴스 하나 안에서만 효과가 있어요.
 */
const inflight = new Map<string, Promise<SessionTokens | null>>()

export function reissueAccessToken(refreshToken: string): Promise<SessionTokens | null> {
  const existing = inflight.get(refreshToken)
  if (existing) return existing

  const task = (async (): Promise<SessionTokens | null> => {
    try {
      const res = await fetch(backendUrl(BACKEND_PATHS.tokenReissue), {
        method: 'GET',
        headers: { 'Authorization-Refresh': `Bearer ${refreshToken}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) return null

      // 새 access 는 응답 헤더 Authorization 에 담겨 와요.
      // 혹시 body(data.accessToken)로 오는 경우도 대비해요.
      let accessToken = stripBearer(res.headers.get('authorization'))
      let newRefresh = stripBearer(res.headers.get('authorization-refresh'))
      if (!accessToken) {
        const body = (await res.json().catch(() => null)) as ApiEnvelope<{
          accessToken?: string
          refreshToken?: string
        }> | null
        accessToken = body?.data?.accessToken
        newRefresh = newRefresh ?? body?.data?.refreshToken
      }
      if (!accessToken) return null

      return { accessToken, refreshToken: newRefresh }
    } catch (error) {
      console.error('[auth] token reissue failed', error)
      return null
    } finally {
      // 잠깐 뒤에 지워서, 거의 동시에 들어온 요청도 같은 결과를 쓰게 해요.
      setTimeout(() => inflight.delete(refreshToken), 5_000)
    }
  })()

  inflight.set(refreshToken, task)
  return task
}

export interface KakaoLoginData {
  accessToken: string
  refreshToken: string
  userId: number
  userName?: string
  userEmail?: string
  userRole?: UserRole
}

export async function kakaoLogin(code: string): Promise<KakaoLoginData | null> {
  const url = new URL(backendUrl(BACKEND_PATHS.kakaoLogin))
  url.searchParams.set('code', code)
  url.searchParams.set('redirectUri', process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI ?? '')

  try {
    const res = await fetch(url, { method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(15_000) })
    const body = (await res.json().catch(() => null)) as ApiEnvelope<KakaoLoginData> | null
    if (!res.ok || !body?.success || !body.data?.accessToken) {
      console.error('[auth] kakao login failed', res.status, body?.message)
      return null
    }
    return body.data
  } catch (error) {
    console.error('[auth] kakao login error', error)
    return null
  }
}
