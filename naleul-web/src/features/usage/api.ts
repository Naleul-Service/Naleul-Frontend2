import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/client/api'

/**
 * 하루 횟수가 정해진 기능의 오늘 사용량 (GET /api/v1/ai-usage).
 * 한도에 걸린 뒤에야 알리는 대신, 시작 전에 "오늘 3/5회 남음"을 보여주려고 써요.
 */
export interface UsageItem {
  /** GOAL_SESSION · GOAL_DRAFT · TASK_PER_DAY · SESSION_REGENERATE */
  key: string
  label: string
  description: string
  used: number
  /** null 이면 제한 없음 */
  limit: number | null
  remaining: number | null
}

export interface AiUsage {
  pro: boolean
  /** 다시 채워지는 시각 (내일 0시, 한국 시간) */
  resetsAt: string
  items: UsageItem[]
  /** sessionId 를 넘겼을 때: 그 목표 대화에서 계획을 만들 수 있는 횟수 */
  session: UsageItem | null
}

export const usageKeys = {
  all: ['ai-usage'] as const,
  of: (sessionId?: number) => [...usageKeys.all, sessionId ?? null] as const,
}

export function useAiUsage(sessionId?: number) {
  return useQuery({
    queryKey: usageKeys.of(sessionId),
    queryFn: () => api.get<AiUsage>(`/v1/ai-usage${sessionId ? `?sessionId=${sessionId}` : ''}`),
    staleTime: 30_000,
  })
}

/** 횟수를 쓰는 동작(목표 대화 시작·초안 생성·Task 추가) 뒤에 다시 불러와요 */
export function useRefreshUsage() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: usageKeys.all })
}

export const usageItem = (u: AiUsage | undefined, key: string) => u?.items.find((i) => i.key === key)
