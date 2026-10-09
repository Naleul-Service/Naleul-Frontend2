import type { Metadata } from "next";
import { cookies } from "next/headers";
import { NotificationSettingsView } from "@/features/notification-settings/ui/NotificationSettingsView";
import { COOKIE } from "@/lib/server/session";

export const metadata: Metadata = { title: "알림 설정" };

/** Task·미션 푸시 알림 on/off (iOS PushNotificationSettingView) */
export default async function NotificationSettingsPage() {
  const role = (await cookies()).get(COOKIE.userRole)?.value ?? "FREE";
  // iOS 와 같은 규칙: FREE 는 잠금, PRO·ADMIN 은 사용 가능
  return <NotificationSettingsView locked={role === "FREE"} />;
}
