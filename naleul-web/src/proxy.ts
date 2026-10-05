/**
 * Next.js 16 의 proxy (예전 이름: middleware)
 * 페이지 이동마다 실행돼요.
 *
 *  - 로그인 안 됐으면 → /login?redirect=원래경로
 *  - accessToken 이 만료(직전)이면 → refreshToken 으로 미리 재발급
 *    · 새 토큰을 "브라우저 응답"과 "지금 처리 중인 요청" 양쪽에 넣어요.
 *      응답에만 넣으면 이번 화면의 서버 컴포넌트는 여전히 옛 쿠키를 읽어서 첫 화면이 실패해요.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { isJwtExpired } from '@/lib/jwt'
import { reissueAccessToken } from '@/lib/server/authApi'
import { COOKIE, clearSessionCookies, setTokenCookies } from '@/lib/server/session'

const PUBLIC_PATHS = ['/login']

const isPublic = (pathname: string) => PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))

function redirectToLogin(req: NextRequest) {
  const url = new URL('/login', req.url)
  const target = req.nextUrl.pathname + req.nextUrl.search
  if (target !== '/') url.searchParams.set('redirect', target)
  return NextResponse.redirect(url)
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const access = req.cookies.get(COOKIE.access)?.value
  const refresh = req.cookies.get(COOKIE.refresh)?.value
  const accessValid = !!access && !isJwtExpired(access)

  if (isPublic(pathname)) {
    // 이미 로그인된 사용자가 /login 에 오면 홈으로
    if (accessValid) return NextResponse.redirect(new URL('/', req.url))
    return NextResponse.next()
  }

  if (accessValid) return NextResponse.next()
  if (!refresh) return redirectToLogin(req)

  const tokens = await reissueAccessToken(refresh)
  if (!tokens) {
    const res = redirectToLogin(req)
    clearSessionCookies(res.cookies)
    return res
  }

  // 지금 요청에도 새 쿠키 반영 (req.cookies.set 은 요청의 cookie 헤더를 바꿔요)
  req.cookies.set(COOKIE.access, tokens.accessToken)
  if (tokens.refreshToken) req.cookies.set(COOKIE.refresh, tokens.refreshToken)

  const res = NextResponse.next({ request: { headers: req.headers } })
  setTokenCookies(res.cookies, tokens)
  return res
}

export const config = {
  // api, redirect(카카오 콜백), Next 내부 파일, 정적 파일은 제외
  matcher: ['/((?!api|redirect|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|txt|xml)$).*)'],
}
