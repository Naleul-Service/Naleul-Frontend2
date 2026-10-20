import { cn } from '@/lib/cn'
import { kakaoAuthUrl } from './kakaoAuth'

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

/** 카카오 로그인 버튼. 로그인이 끝나면 next 경로로 돌아와요. */
export function KakaoLoginButton({ next, className }: { next: string; className?: string }) {
  return (
    <a
      href={kakaoAuthUrl(next)}
      className={cn(
        'flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-[#FEE500] text-[15px] font-semibold text-[#191600] transition hover:brightness-95',
        className
      )}
    >
      <KakaoIcon />
      카카오로 시작하기
    </a>
  )
}
