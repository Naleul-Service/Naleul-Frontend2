import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, isApiError } from '@/lib/client/api'
import { toast } from '@/stores/toastStore'
import { goalKeys } from '@/features/goal/api'
import { timetableKeys } from '@/features/timetable/api'
import type { PatternPeriod, PatternReport, SuggestionApplyResult } from './types'

export const patternKeys = {
  all: ['pattern'] as const,
  report: (period: PatternPeriod) => [...patternKeys.all, 'report', period] as const,
}

/**
 * GET /patterns?period=
 * 서버가 하루 한 번만 계산하고 캐시해요 (분석 범위가 어제까지라 같은 날엔 바뀌지 않음).
 * 그래서 화면에서도 오래 신선하게 둬요.
 */
export function usePatternReport(period: PatternPeriod) {
  return useQuery({
    queryKey: patternKeys.report(period),
    queryFn: () => api.get<PatternReport>(`/v1/patterns?period=${period}`),
    staleTime: 10 * 60 * 1000,
    placeholderData: (prev) => prev, // 기간을 바꿀 때 이전 화면 유지
  })
}

const errorMessage = (e: unknown) => (isApiError(e) ? e.message : '문제가 생겼어요. 다시 시도해 주세요.')

// key 에 ":" 가 들어가요 (ROUTINE_TIME:31:12:40) → 경로에 넣을 때 인코딩
const suggestionPath = (key: string, action: 'apply' | 'dismiss') =>
  `/v1/patterns/suggestions/${encodeURIComponent(key)}/${action}`

/**
 * 제안 여러 개를 차례로 반영해요 (하나 실패해도 나머지는 계속).
 * 루틴·TimeTable·목표 화면이 모두 바뀌므로 관련 캐시를 전부 다시 불러와요.
 */
export function useApplySuggestions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (keys: string[]) => {
      const applied: SuggestionApplyResult[] = []
      const failed: { key: string; message: string }[] = []
      for (const key of keys) {
        try {
          applied.push(await api.post<SuggestionApplyResult>(suggestionPath(key, 'apply')))
        } catch (e) {
          failed.push({ key, message: errorMessage(e) })
        }
      }
      return { applied, failed }
    },
    onSuccess: ({ applied, failed }) => {
      if (applied.length && !failed.length) toast.success('TimeBlock에 반영했어요. 내일부터 적용돼요.')
      else if (applied.length)
        toast.error(`${applied.length}개는 반영했지만 ${failed.length}개는 못 했어요. ${failed[0].message}`)
      else if (failed.length) toast.error(failed[0].message)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: patternKeys.all })
      qc.invalidateQueries({ queryKey: timetableKeys.all })
      qc.invalidateQueries({ queryKey: goalKeys.all })
    },
  })
}

export function useDismissSuggestions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (keys: string[]) => {
      for (const key of keys) await api.post(suggestionPath(key, 'dismiss'))
    },
    onSuccess: () => toast.success('이 제안은 일주일 동안 보이지 않아요.'),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => qc.invalidateQueries({ queryKey: patternKeys.all }),
  })
}
