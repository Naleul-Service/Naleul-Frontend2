import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, isApiError } from '@/lib/client/api'
import { toast } from '@/stores/toastStore'
import { goalKeys, type GoalCategory } from '@/features/goal/api'
import { activityKeys } from '@/features/timetable/api'
import type { ActualActivity } from '@/features/timetable/types'
import type { GoalSubType, GoalType } from '@/features/goal/kind'

/**
 * 기록형 목표 (백엔드 V39 goal_mode = RECORD)
 *
 * 회사 업무처럼 "무엇을 이룰지"보다 "오늘 무엇을 했는지"를 쌓는 목표예요.
 * 종료일·수치·마일스톤 없이 이름만으로 만들고, 기록은 "실제로 한 일"(ActualActivity)로 모아요.
 */

const errorMessage = (e: unknown) => (isApiError(e) ? e.message : '문제가 생겼어요. 다시 시도해 주세요.')

export const recordKeys = {
  all: ['record'] as const,
  goal: (goalId: number) => [...recordKeys.all, 'goal', goalId] as const,
}

// ── 기록형 목표 만들기 ──────────────────────────────────────────

export interface RecordGoalInput {
  name: string
  emoji?: string | null
  /** 비우면 서버가 안 쓰는 색을 골라요 */
  colorId?: number | null
  goalType?: GoalType | null
  goalSubType?: GoalSubType | null
  goalKindLabel?: string | null
}

export function useCreateRecordGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RecordGoalInput) => api.post<GoalCategory>('/v1/goal-categories/record', body),
    onSuccess: () => toast.success('기록형 목표를 만들었어요. 오늘 한 일을 바로 적어 보세요.'),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => qc.invalidateQueries({ queryKey: goalKeys.all }),
  })
}

/** 임시 목표 → 기록형 목표로 그대로 두기 (구체화 없이) */
export function useKeepAsRecord(goalId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.patch<GoalCategory>(`/v1/goal-categories/${goalId}/keep-as-record`),
    onSuccess: () => toast.success('기록형 목표로 바꿨어요.'),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => qc.invalidateQueries({ queryKey: goalKeys.all }),
  })
}

// ── 한 일 빠르게 기록하기 (POST /activities/logs) ───────────────

export interface ActivityLogItem {
  clientKey: string
  /** 사용자가 적은 문장 그대로 — 서버가 시각·걸린 시간을 읽어요 */
  text: string
  /** 아래는 AI 해석 결과를 쓸 때만 (보낸 값이 문장보다 우선) */
  title?: string | null
  date?: string | null
  startTime?: string | null
  endTime?: string | null
  minutes?: number | null
  goalCategoryId?: number | null
  tempGoalKey?: string | null
}

export interface ActivityLogRequest {
  items: ActivityLogItem[]
  tempGoals?: {
    tempKey: string
    name: string
    emoji?: string | null
    colorId?: number | null
  }[]
}

export interface ActivityLogResponse {
  activities: ActualActivity[]
  tempGoals: {
    tempKey: string
    goalCategoryId: number
    name: string
    emoji: string | null
    colorCode: string | null
  }[]
}

export function useLogActivities() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ActivityLogRequest) => api.post<ActivityLogResponse>('/v1/activities/logs', body),
    onError: (e) => toast.error(errorMessage(e)),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: activityKeys.all })
      qc.invalidateQueries({ queryKey: recordKeys.all })
      if (res.tempGoals.length) qc.invalidateQueries({ queryKey: goalKeys.all })
    },
  })
}

/** 목표에 쌓인 기록, 최근 것부터 */
export function useGoalActivities(goalId: number, size = 60) {
  return useQuery({
    queryKey: recordKeys.goal(goalId),
    queryFn: async () => (await api.get<ActualActivity[]>(`/v1/activities/goals/${goalId}?size=${size}`)) ?? [],
  })
}

export function useDeleteRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (activityId: number) => api.delete(`/v1/activities/${activityId}`),
    onSuccess: () => toast.success('기록을 지웠어요.'),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: activityKeys.all })
      qc.invalidateQueries({ queryKey: recordKeys.all })
    },
  })
}

let seq = 0
export const newClientKey = () => `r${Date.now().toString(36)}${(seq++).toString(36)}`
