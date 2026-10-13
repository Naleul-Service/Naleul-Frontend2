'use client'

import { useEffect, useRef } from 'react'
import Script from 'next/script'
import { cn } from '@/lib/cn'

/**
 * 배너 광고 자리 (Google AdSense) — Free · 둘러보기 사용자에게만 보여요. Pro 는 광고 없음.
 *
 * 아직 광고 계정이 없어서 "자리"만 먼저 만들어 뒀어요. 환경변수만 넣으면 실제 광고가 나와요.
 *   NEXT_PUBLIC_ADSENSE_CLIENT = ca-pub-xxxxxxxxxxxxxxxx   (AdSense 게시자 ID)
 *   NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR = 1234567890            (광고 단위 ID)
 *   NEXT_PUBLIC_ADSENSE_TEST = true                         (테스트 광고 — 승인 전 · 개발 중)
 * 값이 없으면: 개발 환경에서는 점선 "광고 자리"를, 운영에서는 아무것도 안 보여줘요.
 */
const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT
const TEST = process.env.NEXT_PUBLIC_ADSENSE_TEST === 'true'
const SLOTS = {
  sidebar: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR,
} as const

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

export function AdSlot({
  placement,
  role,
  className,
}: {
  placement: keyof typeof SLOTS
  role?: string
  className?: string
}) {
  const slot = SLOTS[placement]
  const pushed = useRef(false)
  const show = role !== 'PRO' && role !== 'ADMIN'

  useEffect(() => {
    if (!show || !CLIENT || !slot || pushed.current) return
    pushed.current = true
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      /* 광고 차단기 등 — 조용히 무시 */
    }
  }, [show, slot])

  if (!show) return null

  if (!CLIENT || !slot) {
    if (process.env.NODE_ENV === 'production') return null
    return (
      <div
        className={cn(
          'border-line-strong text-ink-4 grid h-[90px] place-items-center rounded-xl border border-dashed text-[12px]',
          className
        )}
      >
        광고 자리 (AdSense 설정 전)
      </div>
    )
  }

  return (
    <div className={cn('overflow-hidden rounded-xl', className)} aria-label="광고">
      <Script
        id="adsbygoogle-js"
        async
        strategy="afterInteractive"
        crossOrigin="anonymous"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`}
      />
      <ins
        className="adsbygoogle block"
        style={{ display: 'block', width: '100%', height: 90 }}
        data-ad-client={CLIENT}
        data-ad-slot={slot}
        data-ad-format="horizontal"
        data-full-width-responsive="false"
        {...(TEST ? { 'data-adtest': 'on' } : {})}
      />
      <p className="text-ink-4 mt-1 text-right text-[10px]">
        광고 ·{' '}
        <a href="/settings/membership" className="hover:underline">
          Pro는 광고 없이
        </a>
      </p>
    </div>
  )
}
