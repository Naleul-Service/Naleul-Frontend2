import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, isApiError } from '@/lib/client/api'
import type { AdminDashboard } from './types'

/**
 * 운영 대시보드 (GET /api/v1/admin/dashboard?days=30).
 * 운영진이 아니면 백엔드가 403 을 줘요 — 버튼을 숨기는 것과 별개로 서버에서 막아요.
 */
export const adminDashboardKeys = {
  all: ['admin-dashboard'] as const,
  of: (days: number) => [...adminDashboardKeys.all, days] as const,
}

export function useAdminDashboard(days: number) {
  return useQuery({
    queryKey: adminDashboardKeys.of(days),
    queryFn: () => api.get<AdminDashboard>(`/v1/admin/dashboard?days=${days}`),
    staleTime: 60_000,
    // 기간을 바꾸는 동안 이전 숫자를 그대로 보여줘요 (화면이 깜빡이지 않게)
    placeholderData: keepPreviousData,
    // 403(운영진 아님)은 다시 시도해도 같아요
    retry: (count, e) => !(isApiError(e) && e.httpStatus === 403) && count < 2,
  })
}
