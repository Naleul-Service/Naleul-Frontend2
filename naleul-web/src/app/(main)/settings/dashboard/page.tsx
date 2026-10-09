import type { Metadata } from 'next'
import { DashboardView } from '@/features/admin-dashboard/ui/DashboardView'

export const metadata: Metadata = { title: '운영 대시보드' }

/**
 * /settings/dashboard — 운영 대시보드 (dev 전용).
 * 설정 화면의 버튼은 main 배포 전에 주석 처리해요. 주소를 알아도 운영진이 아니면 백엔드가 403 을 줘요.
 */
export default function AdminDashboardPage() {
  return <DashboardView />
}
