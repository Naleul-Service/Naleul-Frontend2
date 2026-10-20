/**
 * Amplitude 이벤트를 한 곳에서 관리해요. (iOS/Android 의 AnalyticsService 와 같은 역할)
 * 화면에서는 Amplitude SDK 를 직접 import 하지 말고 이 파일의 함수만 써요.
 *
 * 규칙은 Notion "Tracking Plan" 을 따라요.
 *  - 이벤트 이름은 'page.action' 그대로 (예: login_modal.kakao_click)
 *  - 이메일 · 닉네임 · 자유 입력 원문은 보내지 않아요
 *  - 페이지를 떠나기 직전 이벤트는 trackBeforeLeave (beacon 전송)
 *  - 로그아웃 직후 resetAnalytics() → 다음 사람의 둘러보기 이벤트가 이전 사용자에게 붙지 않아요
 *
 * NEXT_PUBLIC_AMPLITUDE_API_KEY 가 비어 있으면 아무것도 보내지 않아요 (로컬 개발 등).
 */
import * as amplitude from '@amplitude/analytics-browser'

const API_KEY = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY ?? ''
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? ''

/** Tracking Plan 의 event 컬럼 값 */
import { HOME_EVENTS, type HomeEventName } from './homeEvents'
import { COMMON_EVENTS, type CommonEventName } from './commonEvents'
import type { GoalCreationEventName } from './goalCreationEvents'
import type { GoalDetailEventName } from './goalDetailEvents'
import type { WorkGoalEventName } from './workGoalEvents'
import type { TaskAddEventName } from './taskAddEvents'
import type { CalendarEventName } from './calendarEvents'
import type { ReflectionEventName } from './reflectionEvents'

/** 화면별 이벤트 이름 모음 (홈은 개수가 많아 homeEvents.ts 로 나눴어요) */
export { HOME_EVENTS, COMMON_EVENTS }

export const EVENTS = {
  guestSessionStart: 'guest.session_start',
  guestBannerLoginClick: 'guest_banner.login_click',
  sidebarGuestLoginClick: 'sidebar.guest_login_click',
  sidebarLogoutClick: 'sidebar.logout_click',

  loginPageview: 'login.pageview',
  loginKakaoClick: 'login.kakao_click',
  loginAppleClick: 'login.apple_click',
  loginIosAppDownloadClick: 'login.ios_app_download_click',
  loginComplete: 'login.complete',
  loginFail: 'login.fail',
  loginOauthBack: 'login.oauth_back',

  loginModalView: 'login_modal.view',
  loginModalClose: 'login_modal.close',
  loginModalKakaoClick: 'login_modal.kakao_click',
  loginModalAppleClick: 'login_modal.apple_click',

  settingsLogoutClick: 'settings.logout_click',
  settingsLogoutCancelClick: 'settings.logout_cancel_click',
  settingsLogoutConfirmClick: 'settings.logout_confirm_click',
} as const

export type AnalyticsEventName =
  | (typeof EVENTS)[keyof typeof EVENTS]
  | HomeEventName
  | CommonEventName
  | GoalCreationEventName
  | GoalDetailEventName
  | WorkGoalEventName
  | TaskAddEventName
  | CalendarEventName
  | ReflectionEventName

/** event property. Tracking Plan 의 varchar → string, int → number, boolean → boolean */
export type EventProps = Record<string, string | number | boolean | null | undefined>

export type AnalyticsUserRole = 'GUEST' | 'FREE' | 'PRO' | 'ADMIN'

let warnedMissingKey = false
const enabled = () => {
  if (typeof window === 'undefined') return false
  if (!API_KEY) {
    // NEXT_PUBLIC_ 변수는 빌드 때 코드에 박혀요. Vercel 에 키를 안 넣고 배포하면 조용히 아무것도 안 가서, 콘솔에 한 번 알려요
    if (!warnedMissingKey) console.warn('Amplitude API key missing — analytics disabled')
    warnedMissingKey = true
    return false
  }
  return true
}
let initialized = false

/** undefined · null 인 속성은 빼요 (Amplitude 에 "null" 문자열로 쌓이지 않게) */
function clean(props?: EventProps) {
  if (!props) return undefined
  const out: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(props)) if (v !== undefined && v !== null) out[k] = v
  return out
}

/**
 * SDK 초기화 — 여러 번 불러도 한 번만 돼요. track 등 모든 함수가 먼저 부르므로 직접 부를 일은 거의 없어요.
 * autocapture 는 수동 이벤트와 겹치지 않게 sessions · attribution · frustration(rage/dead click) 만 켜요.
 */
export function initAnalytics() {
  if (initialized || !enabled()) return
  initialized = true
  amplitude.init(API_KEY, {
    appVersion: APP_VERSION || undefined,
    autocapture: {
      sessions: true,
      attribution: true,
      pageViews: false,
      elementInteractions: false,
      formInteractions: false,
      fileDownloads: false,
      frustrationInteractions: true, // rage click · dead click (노션 규칙: 화면 전체 UX 신호)
      networkTracking: false,
      webVitals: false,
    },
    logLevel: process.env.NODE_ENV === 'production' ? amplitude.Types.LogLevel.Warn : amplitude.Types.LogLevel.Debug,
  })
  // 탭을 닫거나 다른 사이트로 갈 때 아직 안 보낸 이벤트를 beacon 으로 마저 보내요
  window.addEventListener('pagehide', () => {
    amplitude.setTransport('beacon')
    amplitude.flush()
  })
}

/**
 * 화면 첫 동작 · 머문 시간(*.first_interaction / *.page_exit)을 세는 쪽(usePageEngagement)에 알려 줘요.
 * '{page}.' 로 시작하는 "사용자 동작" 이벤트가 나갈 때마다 불려요. (보기 · 결과 · 실패 같은 이벤트는 빼요)
 */
type InteractionListener = (event: string) => void
const interactionListeners = new Set<InteractionListener>()
export function onInteraction(listener: InteractionListener) {
  interactionListeners.add(listener)
  return () => {
    interactionListeners.delete(listener)
  }
}
/** 사용자가 직접 한 동작이 아닌 이벤트 (화면이 보여 준 것 · 요청 결과 · 자동으로 일어난 것) */
const PASSIVE = [
  '.pageview',
  '.page_exit',
  '.first_interaction',
  '_view',
  '.load_fail',
  '_load_fail',
  '_result',
  '.scroll_depth',
  '.section_scroll',
  '.day_rollover',
  '_invalid',
  '_discard',
]
const isPassive = (event: string) => PASSIVE.some((p) => event.endsWith(p))

export function track(event: AnalyticsEventName, props?: EventProps) {
  if (!isPassive(event)) interactionListeners.forEach((l) => l(event))
  if (!enabled()) return
  initAnalytics()
  amplitude.track(event, clean(props))
}

/** 기다리는 시간 상한 — 분석 때문에 로그아웃 · 이동이 늦어지면 안 돼요 */
const LEAVE_TIMEOUT_MS = 800

/**
 * 페이지를 떠나기 직전 이벤트 (로그아웃, 카카오 · Apple 이동, 외부 링크).
 * 일반 전송(fetch)은 페이지가 바뀌면서 끊길 수 있어서 beacon 으로 보내요.
 * 돌려주는 Promise 는 전송이 끝나거나 800ms 가 지나면 끝나요. (await 하지 않아도 돼요)
 */
export async function trackBeforeLeave(event: AnalyticsEventName, props?: EventProps): Promise<void> {
  if (!isPassive(event)) interactionListeners.forEach((l) => l(event))
  if (!enabled()) return
  initAnalytics()
  amplitude.setTransport('beacon')
  const sent = amplitude.track(event, clean(props)).promise
  amplitude.flush()
  await Promise.race([sent, new Promise((r) => setTimeout(r, LEAVE_TIMEOUT_MS))]).catch(() => undefined)
  amplitude.setTransport('fetch')
}

/**
 * 로그인 사용자 연결 + User Property 갱신.
 * 둘러보기 중 이벤트는 같은 deviceId 라서, setUserId 순간 이 사용자에게 이어 붙어요.
 */
export function identifyUser(user: { userId: string | number; role?: AnalyticsUserRole; provider?: string }) {
  if (!enabled()) return
  initAnalytics()
  const id = String(user.userId)
  if (amplitude.getUserId() !== id) amplitude.setUserId(id)
  setUserProperties({ user_role: user.role, login_provider: user.provider })
}

/** User Property(identify) 만 바꿀 때. user_role(GUEST/FREE/PRO/ADMIN) · login_provider */
export function setUserProperties(props: { user_role?: AnalyticsUserRole; login_provider?: string }) {
  if (!enabled()) return
  initAnalytics()
  const identify = new amplitude.Identify()
  let changed = false
  for (const [k, v] of Object.entries(props)) {
    if (v) {
      identify.set(k, v)
      changed = true
    }
  }
  if (changed) amplitude.identify(identify)
}

/** 지금 연결된 Amplitude userId (없으면 undefined) */
export function currentAnalyticsUserId() {
  if (!enabled()) return undefined
  initAnalytics()
  return amplitude.getUserId()
}

/** 로그아웃 직후: userId 를 지우고 deviceId 를 새로 만들어요 */
export function resetAnalytics() {
  if (!enabled()) return
  initAnalytics()
  amplitude.reset()
}
