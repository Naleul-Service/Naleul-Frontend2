/**
 * 카카오 로그인 콜백 (카카오 콘솔 Redirect URI: {웹 주소}/api/auth/kakao/callback)
 *
 * 1. 카카오가 ?code=...&state=... 로 이 주소를 호출해요.
 * 2. code 를 백엔드에 넘겨 우리 서비스 JWT 를 받아요.
 * 3. 쿠키를 "리다이렉트 응답 자체"에 담아서 보내요. → 브라우저에 확실히 저장돼요.
 * 4. state 에 담아둔 원래 가려던 페이지로 이동해요.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { kakaoLogin } from '@/lib/server/authApi'
import { setTokenCookies, setUserCookies } from '@/lib/server/session'
import { safeRedirectPath } from '@/lib/redirectPath'

export async function GET(request: NextRequest) {
    const { searchParams, origin } = request.nextUrl
    const code = searchParams.get('code')
    const kakaoError = searchParams.get('error')
    const next = safeRedirectPath(searchParams.get('state'))

    const toLogin = (error: string) => NextResponse.redirect(new URL(`/login?error=${error}`, origin))

    if (kakaoError) return toLogin('cancelled')
    if (!code) return toLogin('no_code')

    const result = await kakaoLogin(code)
    if (!result) return toLogin('login_failed')

    const response = NextResponse.redirect(new URL(next, origin))
    setTokenCookies(response.cookies, { accessToken: result.accessToken, refreshToken: result.refreshToken })
    setUserCookies(response.cookies, result, result.refreshToken)
    return response
}
