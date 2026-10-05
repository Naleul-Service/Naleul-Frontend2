import type { Metadata } from 'next'
import { Logo } from '@/components/brand/Logo'
import { safeRedirectPath } from '@/lib/redirectPath'

export const metadata: Metadata = { title: '로그인' }

const IOS_APP_URL = 'https://apps.apple.com/kr/app/%EB%82%98%EB%A5%BC-naleul/id6780154075'

const ERROR_MESSAGES: Record<string, string> = {
  cancelled: '카카오 로그인이 취소됐어요.',
  no_code: '로그인 정보를 받지 못했어요. 다시 시도해 주세요.',
  login_failed: '로그인에 실패했어요. 잠시 후 다시 시도해 주세요.',
}

/**
 * 카카오 인가 URL.
 * state 에 "로그인 후 돌아갈 경로"를 담아요. 카카오가 콜백(/redirect)에 state 를 그대로 돌려줘요.
 */
function kakaoAuthUrl(next: string) {
  const url = new URL('https://kauth.kakao.com/oauth/authorize')
  url.searchParams.set('client_id', process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID ?? '')
  url.searchParams.set('redirect_uri', process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI ?? '')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', next)
  return url.toString()
}

function KakaoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 2C5.582 2 2 4.925 2 8.5c0 2.254 1.42 4.236 3.57 5.387L4.67 17.1a.25.25 0 0 0 .375.27L9.3 14.95c.231.017.464.05.7.05 4.418 0 8-2.925 8-6.5S14.418 2 10 2z"
        fill="#191600"
      />
    </svg>
  )
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>
}) {
  const { redirect, error } = await searchParams
  const next = safeRedirectPath(redirect)
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.login_failed) : null

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-[400px]">
        <Logo size="lg" />

        <h1 className="mt-10 text-[32px] leading-[1.25] font-bold tracking-tight">
          목표를 세우고,
          <br />
          <span className="text-brand">나를</span> 알아가요
        </h1>
        <p className="text-ink-3 mt-3 text-[15px] leading-relaxed">
          AI와 대화하며 목표를 설계하고
          <br />
          매일의 실천을 기록해요.
        </p>

        {errorMessage && (
          <p role="alert" className="bg-danger-soft text-danger mt-8 rounded-xl px-4 py-3 text-sm font-medium">
            {errorMessage}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3">
          <a
            href={kakaoAuthUrl(next)}
            className="flex h-14 items-center justify-center gap-2.5 rounded-2xl bg-[#FEE500] text-[15px] font-semibold text-[#191600] transition hover:brightness-95"
          >
            <KakaoIcon />
            카카오로 시작하기
          </a>
          <a
            href={IOS_APP_URL}
            target="_blank"
            rel="noreferrer"
            className="border-line-strong bg-surface hover:bg-subtle flex h-14 items-center justify-center rounded-2xl border text-[15px] font-semibold transition"
          >
            iOS 앱 다운로드
          </a>
        </div>

        <p className="text-ink-4 mt-10 text-center text-xs">© 2026 나를(Naleul)</p>
      </div>
    </main>
  )
}
