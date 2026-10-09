import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/client/api'
import type { BillingPrepare, BillingStatus, WebPlan } from './types'

export const billingKeys = { status: ['billing', 'status'] as const }

export function useBillingStatus() {
  return useQuery({ queryKey: billingKeys.status, queryFn: () => api.get<BillingStatus>('/billing') })
}

export const prepareBilling = (plan: WebPlan) => api.post<BillingPrepare>('/billing/prepare', { plan })

export const confirmBilling = (authKey: string, customerKey: string) =>
  api.post<BillingStatus>('/billing/confirm', { authKey, customerKey })

function useBillingAction(action: 'cancel' | 'resume') {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<BillingStatus>(`/billing/${action}`),
    onSuccess: (data) => qc.setQueryData(billingKeys.status, data),
  })
}

export const useCancelBilling = () => useBillingAction('cancel')
export const useResumeBilling = () => useBillingAction('resume')
