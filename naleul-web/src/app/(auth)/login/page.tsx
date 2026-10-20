import type { Metadata } from 'next'
import { Logo } from '@/components/brand/Logo'
import { safeRedirectPath } from '@/lib/redirectPath'
import { KakaoLoginButton } from '@/components/auth/KakaoLoginButton'
import { AppleLoginButton } from '@/components/auth/AppleLoginButton'
import { loginErrorMessage } from '@/components/auth/kakaoAuth'

export const metadata: Metadata = { title: '로그인' }

// 평소엔 로그인 모달(LoginRequiredDialog)로 로그인해요.
// 이 페이지는 주소로 직접 들어오거나, 둘러보기 토큰을 못 받았을 때(proxy.ts)만 보여요.

const IOS_APP_URL = 'https://apps.apple.com/kr/app/%EB%82%98%EB%A5%BC-naleul/id6780154075'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>
}) {
  const { redirect, error } = await searchParams
  const next = safeRedirectPath(redirect)
  const errorMessage = loginErrorMessage(error)

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
          <KakaoLoginButton next={next} />
          <AppleLoginButton next={next} />
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
