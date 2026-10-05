import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/client/api'

/**
 * 백엔드 GoalCategoryResponse (목표 = goal_category)
 *
 * AI 목표 생성 필드(emoji, aiNote, metric*, milestones 등)는 사용자가 직접 만든 목표에선 null 이에요.
 */
export type GoalStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DELETED'
export type JavaDayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'

export interface RoutineSummary {
  routineId: number
  routineName: string
  routineStatus: string
  repeatStartDate: string | null
  repeatEndDate: string | null
  /** "19:30:00" (LocalTime) */
  repeatStartTime: string | null
  repeatEndTime: string | null
  repeatDays: JavaDayOfWeek[]
  notificationEnabled: boolean
}

export interface SubGoalInfo {
  generalCategoryId: number
  generalCategoryName: string
  colorCode: string | null
  generalCategoryStartDate: string | null
  generalCategoryEndDate: string | null
  generalCategoryStatus: GoalStatus
  routines: RoutineSummary[]
}

export interface MilestoneInfo {
  milestoneId: number
  title: string
  description: string | null
  dueDate: string
  targetValue: number | null
  status: 'PENDING' | 'ACHIEVED' | 'MISSED'
}

export interface GoalCategory {
  goalCategoryId: number
  goalCategoryName: string
  goalCategoryStatus: GoalStatus
  goalCategoryStartDate: string | null
  goalCategoryEndDate: string | null
  achievement: string | null
  motive: string | null
  colorCode: string | null
  generalCategories: SubGoalInfo[]
  // ── AI 목표 생성 필드 ──
  emoji?: string | null
  goalTopic?: string | null
  description?: string | null
  aiGenerated?: boolean
  planningStyle?: 'PLANNER' | 'SPONTANEOUS' | null
  aiNote?: string | null
  metricName?: string | null
  metricUnit?: string | null
  startValue?: number | null
  currentValue?: number | null
  targetValue?: number | null
  milestones?: MilestoneInfo[] | null
}

export const goalKeys = {
  all: ['goals'] as const,
  list: () => [...goalKeys.all, 'list'] as const,
  detail: (id: number) => [...goalKeys.all, 'detail', id] as const,
}

export function useGoalCategories() {
  return useQuery({
    queryKey: goalKeys.list(),
    // 삭제된 목표는 혹시 내려와도 화면에서 제외
    queryFn: async () =>
      ((await api.get<GoalCategory[]>('/v1/goal-categories')) ?? []).filter((g) => g.goalCategoryStatus !== 'DELETED'),
  })
}

export function useGoalCategory(id: number) {
  return useQuery({
    queryKey: goalKeys.detail(id),
    queryFn: () => api.get<GoalCategory>(`/v1/goal-categories/${id}`),
  })
}
