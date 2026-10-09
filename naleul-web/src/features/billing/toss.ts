/**
 * 토스페이먼츠 결제창 SDK v2 (카드 자동결제 등록).
 * 필요한 설정: .env 의 NEXT_PUBLIC_TOSS_CLIENT_KEY (개발자센터 → API 키 → 클라이언트 키, test_ck_ 로 시작하면 테스트)
 * 시크릿 키(test_sk_)는 서버(백엔드)에만 둬요.
 */
export const tossClientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? ''

interface TossPaymentInstance {
  requestBillingAuth: (o: {
    method: 'CARD'
    successUrl: string
    failUrl: string
    customerName?: string
    customerEmail?: string
  }) => Promise<void>
}
declare global {
  interface Window {
    TossPayments?: (clientKey: string) => { payment: (o: { customerKey: string }) => TossPaymentInstance }
  }
}

let loading: Promise<void> | null = null

function loadSdk(): Promise<void> {
  if (window.TossPayments) return Promise.resolve()
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://js.tosspayments.com/v2/standard'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      loading = null
      reject(new Error('결제창을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'))
    }
    document.head.appendChild(s)
  })
  return loading
}

/**
 * 카드 등록 창을 열어요. 성공하면 토스가 successUrl?customerKey=…&authKey=… 로 이동시켜요.
 * (이 함수가 돌아오기 전에 페이지가 바뀌어요. 사용자가 창을 닫으면 에러로 돌아와요)
 */
export async function openCardRegistration(customerKey: string, customerName?: string | null) {
  if (!tossClientKey) throw new Error('결제 설정(NEXT_PUBLIC_TOSS_CLIENT_KEY)이 아직 없어요.')
  await loadSdk()
  const origin = window.location.origin
  await window.TossPayments!(tossClientKey)
    .payment({ customerKey })
    .requestBillingAuth({
      method: 'CARD',
      successUrl: `${origin}/settings/membership/success`,
      failUrl: `${origin}/settings/membership/fail`,
      ...(customerName ? { customerName } : {}),
    })
}
