'use client'

import { useEffect, useRef, useState } from 'react'
import { CreditCard, Smartphone } from 'lucide-react'
import { Check } from '@/components/icons'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Chip'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { errorStatusOf } from '@/features/home/analytics'
import { track } from '@/lib/client/analytics'
import { referrerType } from '@/lib/client/commonEvents'
import { cn } from '@/lib/cn'
import { toast } from '@/stores/toastStore'
import { prepareBilling, useBillingStatus, useCancelBilling, useResumeBilling } from '../api'
import { PLAN_LABEL, STATUS_LABEL, longDate, won } from '../format'
import { daysLeftOf, membershipStateOf, rememberPlan, webSubscription, type MembershipState } from '../analytics'
import { CardWindowError, openCardRegistration, tossClientKey } from '../toss'
import type { BillingStatus, WebPlan } from '../types'

/**
 * BM(2026-10): 목표 · 루틴 · Task · 회고 만들기와 알림은 Free 도 제한 없이 써요.
 * Pro 는 AI 를 더 많이 + 광고 없이.
 */
const BENEFITS = [
  'AI 목표 만들기 하루 10개 (Free: 하루 1개 · 주 3개)',
  'AI 계획 초안 하루 20번 (Free: 하루 5번)',
  'AI로 목표 고치기 · AI로 일정 조정 · 브레인 덤프 AI 정리 하루 30번 (Free: 각 3번)',
  '광고 없이',
  '웹과 iOS 앱 어디서든 같은 Pro',
]

/** 설정 > 멤버십 — 웹 Pro 구독 (토스페이먼츠 자동결제) */
export function MembershipView() {
  const { data, isPending, isError, error, errorUpdatedAt, refetch } = useBillingStatus()

  // ── 분석 ──
  // membership.pageview — 상태를 불러온 직후 한 번 (해지 · 해지 취소로 데이터가 바뀌어도 다시 안 보냄)
  const pageviewSent = useRef(false)
  useEffect(() => {
    if (!data || pageviewSent.current) return
    pageviewSent.current = true
    track('membership.pageview', {
      membership_state: membershipStateOf(data),
      plan: webSubscription(data)?.plan,
      days_left: daysLeftOf(data),
      referrer_type: referrerType(),
    })
  }, [data])

  // membership.load_fail — 실패 카드가 보일 때 (다시 시도해서 또 실패하면 다시 한 번)
  const loadFailSentAt = useRef(0)
  useEffect(() => {
    if (!isError || loadFailSentAt.current === errorUpdatedAt) return
    loadFailSentAt.current = errorUpdatedAt
    track('membership.load_fail', { error_status: errorStatusOf(error) })
  }, [isError, error, errorUpdatedAt])

  if (isPending)
    return <div className="bg-surface border-line mt-6 h-64 max-w-3xl animate-pulse rounded-card border" />
  if (isError) {
    return (
      <Card className="mt-6 max-w-3xl p-8 text-center">
        <p className="font-bold">멤버십 정보를 불러오지 못했어요</p>
        <p className="text-ink-3 mt-1 text-sm">{error.message}</p>
        <Button
          className="mt-4"
          onClick={() => {
            track('membership.retry_click', { error_status: errorStatusOf(error) })
            refetch()
          }}
        >
          다시 시도
        </Button>
      </Card>
    )
  }

  const webActive = !!webSubscription(data)

  return (
    <div className="mt-6 max-w-3xl space-y-6">
      {data.testMode && (
        <p className="bg-warning-soft text-warning-ink rounded-xl px-4 py-3 text-[13px] font-medium">
          테스트 결제 모드예요. 카드를 등록해도 실제 돈은 나가지 않아요. (인증번호는 000000)
        </p>
      )}

      {webActive ? (
        <SubscriptionCard data={data} />
      ) : data.otherPremium ? (
        <Card className="flex items-start gap-4 p-5 sm:p-6">
          <span className="bg-brand-soft text-text-brand grid size-10 shrink-0 place-items-center rounded-xl">
            <Smartphone className="size-5" />
          </span>
          <div>
            <p className="text-[15px] font-bold">iOS 앱에서 Pro를 이용 중이에요</p>
            <p className="text-ink-3 mt-1 text-[13px]">
              {data.premiumUntil ? `${longDate(data.premiumUntil)}까지 · ` : ''}구독 관리 · 해지는 아이폰 설정 → Apple
              ID → 구독에서 할 수 있어요. 웹에서도 같은 Pro 혜택을 그대로 쓸 수 있어요.
            </p>
          </div>
        </Card>
      ) : (
        <PlanPicker data={data} state={membershipStateOf(data)} />
      )}

      {data.payments.length > 0 && <PaymentHistory payments={data.payments} />}
    </div>
  )
}

function PlanPicker({ data, state }: { data: BillingStatus; state: MembershipState }) {
  const [plan, setPlan] = useState<WebPlan>('PRO_YEARLY')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const monthly = data.plans.find((p) => p.plan === 'PRO_MONTHLY')
  const chosen = data.plans.find((p) => p.plan === plan)
  const ready = data.configured && !!tossClientKey

  // membership.not_ready_view — [UX] 결제 키가 없어 버튼이 꺼진 채 '웹 결제를 준비 중이에요'가 보일 때 한 번
  const notReadySent = useRef(false)
  useEffect(() => {
    if (ready || notReadySent.current) return
    notReadySent.current = true
    track('membership.not_ready_view', { membership_state: state })
  }, [ready, state])

  const start = async () => {
    track('membership.subscribe_click', { plan })
    rememberPlan(plan) // 성공 · 실패 페이지의 plan 속성용 (상품 이름만)
    setBusy(true)
    try {
      let prep
      try {
        prep = await prepareBilling(plan)
      } catch (e) {
        track('membership.card_window_fail', { plan, fail_reason: 'prepare_failed', error_status: errorStatusOf(e) })
        throw e
      }
      try {
        await openCardRegistration(prep.customerKey, prep.customerName) // 성공하면 토스가 성공 페이지로 이동시켜요
      } catch (e) {
        track('membership.card_window_fail', {
          plan,
          fail_reason: e instanceof CardWindowError ? e.reason : 'window_error',
        })
        throw e
      }
    } catch (e) {
      toast.error((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <p className="text-[17px] font-bold">나를 Pro</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {BENEFITS.map((b) => (
          <li key={b} className="text-ink-2 flex items-center gap-2 text-[14px]">
            <Check className="text-text-brand size-4 shrink-0" />
            {b}
          </li>
        ))}
      </ul>

      <div role="radiogroup" aria-label="구독 상품" className="mt-5 grid gap-3 sm:grid-cols-2">
        {data.plans.map((p) => {
          const perMonth = Math.round(p.amount / p.months)
          const save = monthly && p.months > 1 ? Math.round((1 - p.amount / (monthly.amount * p.months)) * 100) : 0
          return (
            <button
              key={p.plan}
              type="button"
              role="radio"
              aria-checked={plan === p.plan}
              onClick={() => {
                if (p.plan !== plan) track('membership.plan_select', { plan: p.plan })
                setPlan(p.plan)
              }}
              className={cn(
                'relative rounded-2xl border p-4 text-left transition-colors',
                plan === p.plan ? 'border-brand bg-brand-soft' : 'border-border-subtle hover:border-line-strong'
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold">{PLAN_LABEL[p.plan]}</span>
                {save > 0 && (
                  <Badge tone="success" className="h-5 px-2 text-[11px]">
                    {save}% 할인
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-[22px] font-bold tracking-tight tabular-nums">
                {won(p.amount)}
                <span className="text-ink-3 text-[13px] font-medium"> / {p.months === 12 ? '년' : '월'}</span>
              </p>
              {p.months > 1 && <p className="text-ink-3 mt-0.5 text-[12px]">월 {won(perMonth)} 꼴</p>}
            </button>
          )
        })}
      </div>

      <label className="text-ink-2 mt-5 flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed">
        <input
          type="checkbox"
          className="accent-brand mt-0.5 size-4 shrink-0"
          checked={agreed}
          onChange={(e) => {
            track('membership.agree_toggle', { checked: e.target.checked, plan })
            setAgreed(e.target.checked)
          }}
        />
        <span>
          {chosen ? `${won(chosen.amount)}이 ${chosen.months === 12 ? '매년' : '매달'} ` : ''}자동으로 결제되는 데
          동의해요. 결제 하루 전까지 설정 → 멤버십에서 언제든 해지할 수 있고, 해지해도 남은 기간까지 Pro를 쓸 수 있어요.
        </span>
      </label>

      <Button
        variant="brand"
        size="lg"
        fullWidth
        className="mt-4"
        disabled={!agreed || !ready}
        loading={busy}
        onClick={start}
      >
        <CreditCard className="size-4" />
        카드 등록하고 구독하기
      </Button>
      {!ready && <p className="text-ink-3 mt-2 text-center text-[12px]">웹 결제를 준비 중이에요.</p>}
    </Card>
  )
}

function SubscriptionCard({ data }: { data: BillingStatus }) {
  const sub = data.subscription!
  const cancel = useCancelBilling()
  const resume = useResumeBilling()
  const [confirming, setConfirming] = useState(false)
  const plan = data.plans.find((p) => p.plan === sub.plan)

  // membership.past_due_view — [UX] '자동 결제에 실패했어요 (N/3)' 문구가 보일 때 한 번
  const pastDue = sub.status === 'PAST_DUE'
  const pastDueSent = useRef(false)
  useEffect(() => {
    if (!pastDue || pastDueSent.current) return
    pastDueSent.current = true
    track('membership.past_due_view', {
      failed_attempts: data.subscription?.failedAttempts,
      plan: data.subscription?.plan,
      days_left: daysLeftOf(data),
    })
  }, [pastDue, data])

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[17px] font-bold">나를 Pro {PLAN_LABEL[sub.plan]}</p>
        <Badge tone={sub.status === 'ACTIVE' ? 'brand' : sub.status === 'PAST_DUE' ? 'danger' : 'neutral'}>
          {STATUS_LABEL[sub.status]}
        </Badge>
      </div>

      <dl className="mt-4 grid gap-3 text-[14px] sm:grid-cols-2">
        <div>
          <dt className="text-ink-3 text-[12px]">이용 기간</dt>
          <dd className="mt-0.5 font-semibold">{longDate(sub.currentPeriodEnd)}까지</dd>
        </div>
        <div>
          <dt className="text-ink-3 text-[12px]">다음 결제</dt>
          <dd className="mt-0.5 font-semibold">
            {sub.status === 'CANCELED'
              ? '없음 (해지 예정)'
              : sub.nextChargeAt
                ? `${longDate(sub.nextChargeAt)} · ${plan ? won(plan.amount) : ''}`
                : '-'}
          </dd>
        </div>
        {sub.cardNumber && (
          <div>
            <dt className="text-ink-3 text-[12px]">결제 카드</dt>
            <dd className="mt-0.5 font-semibold">
              {sub.cardCompany ?? ''} {sub.cardNumber}
            </dd>
          </div>
        )}
      </dl>

      {sub.status === 'PAST_DUE' && (
        <p className="bg-danger-soft text-danger mt-4 rounded-xl px-4 py-3 text-[13px]">
          자동 결제에 실패했어요. 하루 뒤 다시 시도해요 ({sub.failedAttempts}/3). 카드 한도 · 잔액을 확인해 주세요.
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {sub.status === 'CANCELED' ? (
          <Button
            variant="primary"
            loading={resume.isPending}
            onClick={() => {
              track('membership.resume_click', { plan: sub.plan, days_left: daysLeftOf(data) })
              resume.mutate(undefined, {
                onSuccess: () => track('membership.resume_result', { result: 'success' }),
                onError: (e) => {
                  track('membership.resume_result', { result: 'fail', error_status: errorStatusOf(e) })
                  toast.error(e.message)
                },
              })
            }}
          >
            해지 취소하고 계속 구독하기
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={() => {
              track('membership.cancel_click', {
                plan: sub.plan,
                days_left: daysLeftOf(data),
                membership_state: membershipStateOf(data),
              })
              setConfirming(true)
            }}
          >
            구독 해지
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        title="구독을 해지할까요?"
        description={`${longDate(sub.currentPeriodEnd)}까지는 Pro를 그대로 쓸 수 있고, 그 뒤로는 결제되지 않아요.`}
        confirmLabel="해지하기"
        tone="danger"
        loading={cancel.isPending}
        onConfirm={() => {
          track('membership.cancel_confirm', { plan: sub.plan, days_left: daysLeftOf(data) })
          cancel.mutate(undefined, {
            onSuccess: () => {
              track('membership.cancel_result', { result: 'success', plan: sub.plan })
              setConfirming(false)
              toast.success('구독을 해지했어요.')
            },
            onError: (e) => {
              track('membership.cancel_result', { result: 'fail', error_status: errorStatusOf(e), plan: sub.plan })
              toast.error(e.message)
            },
          })
        }}
        onCancel={(method) => {
          track('membership.cancel_dismiss', { plan: sub.plan, close_method: method })
          setConfirming(false)
        }}
      />
    </Card>
  )
}

function PaymentHistory({ payments }: { payments: BillingStatus['payments'] }) {
  return (
    <Card>
      <p className="border-line border-b px-5 py-4 text-[15px] font-bold">결제 내역</p>
      <ul className="divide-line divide-y">
        {payments.map((p, i) => (
          <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-[14px]">
            <span className="text-ink-3 w-[120px] shrink-0 text-[13px]">{longDate(p.at)}</span>
            <span className="flex-1">
              Pro {PLAN_LABEL[p.plan]}
              {p.testMode && <span className="text-ink-4 ml-1.5 text-[12px]">테스트</span>}
            </span>
            <span className={cn('font-semibold tabular-nums', p.status === 'FAILED' && 'text-ink-4 line-through')}>
              {won(p.amount)}
            </span>
            {p.status === 'FAILED' && (
              <span className="text-danger w-full text-[12px]">결제 실패 · {p.failureMessage ?? ''}</span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}
