'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, XCircle } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { billingKeys, confirmBilling } from '../api'
import { PLAN_LABEL, longDate } from '../format'
import type { BillingStatus } from '../types'

/** 토스 카드 등록 성공 → 서버에서 billingKey 발급 + 첫 결제 */
export function BillingSuccessView() {
  const params = useSearchParams()
  const router = useRouter()
  const qc = useQueryClient()
  const [state, setState] = useState<
    { kind: 'loading' } | { kind: 'done'; data: BillingStatus } | { kind: 'error'; message: string }
  >({
    kind: 'loading',
  })
  const started = useRef(false) // 개발 모드에서 effect 가 두 번 돌아도 결제 요청은 한 번만

  const authKey = params.get('authKey')
  const customerKey = params.get('customerKey')

  useEffect(() => {
    if (started.current || !authKey || !customerKey) return
    started.current = true
    confirmBilling(authKey, customerKey)
      .then((data) => {
        qc.setQueryData(billingKeys.status, data)
        setState({ kind: 'done', data })
        router.refresh() // 사이드바 · 설정의 FREE → PRO 표시
      })
      .catch((e: Error) => setState({ kind: 'error', message: e.message }))
  }, [authKey, customerKey, qc, router])

  if (!authKey || !customerKey) {
    return (
      <ResultCard
        ok={false}
        title="결제하지 못했어요"
        message="카드 등록 정보가 없어요. 처음부터 다시 시도해 주세요."
      />
    )
  }
  if (state.kind === 'loading') {
    return (
      <Card className="mt-6 grid max-w-xl place-items-center gap-3 p-10 text-center">
        <Spinner className="size-6" />
        <p className="font-bold">결제하고 있어요</p>
        <p className="text-ink-3 text-sm">창을 닫지 말고 잠시만 기다려 주세요.</p>
      </Card>
    )
  }
  if (state.kind === 'error') return <ResultCard ok={false} title="결제하지 못했어요" message={state.message} />
  const sub = state.data.subscription
  return (
    <ResultCard
      ok
      title="Pro 구독을 시작했어요"
      message={sub ? `Pro ${PLAN_LABEL[sub.plan]} · ${longDate(sub.currentPeriodEnd)}까지 이용할 수 있어요.` : ''}
    />
  )
}

/** 토스 카드 등록 실패 · 취소 (failUrl?code=…&message=…) */
export function BillingFailView() {
  const params = useSearchParams()
  const code = params.get('code')
  const message =
    code === 'PAY_PROCESS_CANCELED' ? '카드 등록을 취소했어요.' : (params.get('message') ?? '카드를 등록하지 못했어요.')
  return <ResultCard ok={false} title="구독하지 않았어요" message={message} />
}

function ResultCard({ ok, title, message }: { ok: boolean; title: string; message: string }) {
  return (
    <Card className="mt-6 max-w-xl p-8 text-center">
      {ok ? (
        <CheckCircle2 className="text-success mx-auto size-10" />
      ) : (
        <XCircle className="text-danger mx-auto size-10" />
      )}
      <p className="mt-3 text-[18px] font-bold">{title}</p>
      {message && <p className="text-ink-3 mt-1.5 text-sm">{message}</p>}
      <div className="mt-6 flex justify-center gap-2">
        <Link href="/settings/membership" className={buttonClass(ok ? 'secondary' : 'primary')}>
          {ok ? '멤버십 보기' : '다시 시도하기'}
        </Link>
        {ok && (
          <Link href="/" className={buttonClass('primary')}>
            홈으로
          </Link>
        )}
      </div>
    </Card>
  )
}
