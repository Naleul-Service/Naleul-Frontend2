export type WebPlan = 'PRO_MONTHLY' | 'PRO_YEARLY'
export type WebSubscriptionStatus = 'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED'

/** GET /api/billing (백엔드 GET /api/v1/web-billing) */
export interface BillingStatus {
  /** 서버에 토스 키가 있는지 — 없으면 "준비 중" */
  configured: boolean
  /** 테스트 키 — 실제 돈이 나가지 않아요 */
  testMode: boolean
  premium: boolean
  premiumUntil: string | null
  /** 웹이 아닌 경로(iOS 앱 구독 등)로 Pro */
  otherPremium: boolean
  plans: { plan: WebPlan; name: string; amount: number; months: number }[]
  subscription: {
    plan: WebPlan
    status: WebSubscriptionStatus
    currentPeriodEnd: string | null
    nextChargeAt: string | null
    cardCompany: string | null
    cardNumber: string | null
    failedAttempts: number
    testMode: boolean
  } | null
  payments: {
    plan: WebPlan
    amount: number
    status: 'DONE' | 'FAILED'
    at: string
    failureMessage: string | null
    testMode: boolean
  }[]
}

export interface BillingPrepare {
  customerKey: string
  orderName: string
  amount: number
  customerName: string | null
  testMode: boolean
}
