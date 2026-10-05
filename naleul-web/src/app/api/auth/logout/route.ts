import { cookies } from 'next/headers'
import { clearSessionCookies } from '@/lib/server/session'

/** 로그아웃: 브라우저 쿠키 삭제 (Route Handler 응답이라 실제로 브라우저에서 지워져요) */
export async function POST() {
  clearSessionCookies(await cookies())
  return new Response(null, { status: 204 })
}
