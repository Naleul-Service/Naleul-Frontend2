import type { Metadata } from 'next'
import { NotificationSettingsView } from '@/features/notification-settings/ui/NotificationSettingsView'

export const metadata: Metadata = { title: '알림 설정' }

/**
 * Task·미션 푸시 알림 on/off (iOS PushNotificationSettingView)
 * BM(2026-10): 알림은 Free 도 쓸 수 있어요 (AI 만 횟수 제한) → 잠금 없음
 */
export default function NotificationSettingsPage() {
  return <NotificationSettingsView locked={false} />
}
