import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, isApiError } from '@/lib/client/api'
import { toast } from '@/stores/toastStore'
import { timetableKeys } from '@/features/timetable/api'
import type { TimeBlockTask } from '@/features/timetable/types'

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
  tasks: (id: number) => [...goalKeys.all, 'tasks', id] as const,
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

/**
 * GET /goal-categories/{id}/tasks — 목표에 속한 Task 전체 (AI 생성·직접 추가·루틴)
 * 서버가 정렬해서 내려줘요: 미완료 먼저 · 오늘과 가까운 날짜 먼저 · 완료는 아래 (최근 것 먼저)
 */
export interface GoalTasksResponse {
  totalCount: number
  todoCount: number
  completedCount: number
  tasks: TimeBlockTask[]
}

export function useGoalTasks(goalId: number) {
  return useQuery({
    queryKey: goalKeys.tasks(goalId),
    queryFn: () => api.get<GoalTasksResponse>(`/v1/goal-categories/${goalId}/tasks`),
  })
}

/** 목표 상세에서 완료 체크 / 취소. 캘린더(TimeTable)도 같이 다시 불러와요 */
export function useToggleGoalTask(goalId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (t: Pick<TimeBlockTask, 'taskId' | 'taskStatus'>) =>
      api.patch(`/v1/tasks/${t.taskId}/${t.taskStatus === 'COMPLETED' ? 'cancel-complete' : 'complete'}`),
    onSuccess: (_, t) => toast.success(t.taskStatus === 'COMPLETED' ? '완료를 취소했어요.' : '완료했어요.'),
    onError: (e) => toast.error(isApiError(e) ? e.message : '문제가 생겼어요. 다시 시도해 주세요.'),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: goalKeys.tasks(goalId) })
      qc.invalidateQueries({ queryKey: timetableKeys.all })
    },
  })
}
