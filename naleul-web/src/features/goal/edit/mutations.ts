import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, isApiError } from '@/lib/client/api'
import { toast } from '@/stores/toastStore'
import { timetableKeys } from '@/features/timetable/api'
import type { TimeBlockTask } from '@/features/timetable/types'
import { goalKeys, type GoalCategory, type JavaDayOfWeek, type MilestoneInfo } from '../api'
import type { GoalSubType, GoalType } from '../kind'

/**
 * 목표 상세에서 쓰는 추가·수정·삭제 API.
 * 어떤 걸 바꿔도 목표(목록·상세·관련 Task)와 캘린더를 다시 불러와요.
 * (세부 목표·루틴을 바꾸면 Task 가 새로 생기거나 지워지므로 부분 갱신보다 다시 조회가 안전)
 */

const errorMessage = (e: unknown) => (isApiError(e) ? e.message : '문제가 생겼어요. 다시 시도해 주세요.')

function useGoalMutation<V, R = unknown>(fn: (v: V) => Promise<R>, success?: string | ((v: V) => string)) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (_, v) => {
      const msg = typeof success === 'function' ? success(v) : success
      if (msg) toast.success(msg)
    },
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: goalKeys.all })
      qc.invalidateQueries({ queryKey: timetableKeys.all })
    },
  })
}

// ─── 전체 목표 ───────────────────────────────────────────────

export interface GoalCreateInput {
  goalCategoryName: string
  goalCategoryStartDate: string
  goalCategoryEndDate: string
  colorId: number
  motive?: string
  emoji?: string
  metricName?: string
  metricUnit?: string
  startValue?: number | null
  targetValue?: number | null
  goalType?: GoalType
  goalSubType?: GoalSubType
  goalKindLabel?: string
}

/**
 * 직접 목표 만들기 — 목표를 만든 뒤 적어 둔 세부 목표들을 같은 기간·색으로 이어서 만들어요.
 * 세부 목표 하나가 실패해도 목표는 이미 만들어졌으니, 나머지는 상세 화면에서 추가하도록 안내해요.
 */
export function useCreateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ subGoals, ...goal }: GoalCreateInput & { subGoals: string[] }) => {
      const created = await api.post<GoalCategory>('/v1/goal-categories', goal)
      let failed = 0
      for (const name of subGoals) {
        try {
          await api.post('/v1/general-categories', {
            generalCategoryName: name,
            goalCategoryId: created.goalCategoryId,
            generalCategoryStartDate: goal.goalCategoryStartDate,
            generalCategoryEndDate: goal.goalCategoryEndDate,
            colorId: goal.colorId,
          })
        } catch {
          failed++
        }
      }
      return { goal: created, failed }
    },
    onSuccess: ({ failed }) =>
      failed
        ? toast.error(`목표는 만들었지만 세부 목표 ${failed}개를 만들지 못했어요. 상세 화면에서 다시 추가해 주세요.`)
        : toast.success('목표를 만들었어요. 루틴·마일스톤·Task도 바로 추가해 보세요.'),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => qc.invalidateQueries({ queryKey: goalKeys.all }),
  })
}

export interface GoalUpdateInput {
  goalCategoryName?: string
  motive?: string
  goalCategoryStartDate?: string
  goalCategoryEndDate?: string
  colorId?: number
  /** 문자열은 "" 를 보내면 지워져요 */
  emoji?: string
  description?: string
  metricName?: string
  metricUnit?: string
  startValue?: number | null
  currentValue?: number | null
  targetValue?: number | null
  /** 목표 카테고리 — "기타"면 goalKindLabel 1~10자 */
  goalType?: GoalType
  goalSubType?: GoalSubType
  goalKindLabel?: string
}

export const useUpdateGoal = (goalId: number) =>
  useGoalMutation(
    (v: GoalUpdateInput) => api.patch<GoalCategory>(`/v1/goal-categories/${goalId}`, v),
    '목표를 수정했어요.'
  )

/** 목표 삭제 — 세부 목표·루틴(과 루틴 Task)도 함께 지워져요 */
export const useDeleteGoal = (goalId: number) =>
  useGoalMutation(() => api.delete(`/v1/goal-categories/${goalId}`), '목표를 삭제했어요.')

// ─── 세부 목표 (general category) ─────────────────────────────

export interface SubGoalInput {
  generalCategoryName: string
  generalCategoryStartDate: string
  generalCategoryEndDate: string
  colorId?: number
}

export const useCreateSubGoal = (goalId: number) =>
  useGoalMutation(
    (v: SubGoalInput & { colorId: number }) => api.post('/v1/general-categories', { ...v, goalCategoryId: goalId }),
    '세부 목표를 추가했어요.'
  )

export const useUpdateSubGoal = () =>
  useGoalMutation(
    ({ id, ...v }: SubGoalInput & { id: number }) => api.put(`/v1/general-categories/${id}`, v),
    '세부 목표를 수정했어요.'
  )

export const useDeleteSubGoal = () =>
  useGoalMutation((id: number) => api.delete(`/v1/general-categories/${id}`), '세부 목표를 삭제했어요.')

// ─── 루틴 ───────────────────────────────────────────────────

export interface RoutineInput {
  generalCategoryId: number
  routineName: string
  repeatStartDate: string
  repeatEndDate: string
  repeatDays: JavaDayOfWeek[]
  /** "HH:mm" — 없으면 null (자동 배치가 시간을 정해요) */
  repeatStartTime: string | null
  repeatEndTime: string | null
  notificationEnabled: boolean
  /** 하는 방법 — 수정 때 "" 를 보내면 지워져요 */
  description?: string
}

export const useCreateRoutine = (goalId: number) =>
  useGoalMutation((v: RoutineInput) => api.post('/v1/routines', { ...v, goalCategoryId: goalId }), '루틴을 추가했어요.')

/** 루틴 수정 — 오늘 이후의 루틴 Task 가 새 설정으로 다시 만들어져요 (지난 기록은 그대로) */
export const useUpdateRoutine = () =>
  useGoalMutation(
    ({ id, ...v }: Partial<RoutineInput> & { id: number }) => api.patch(`/v1/routines/${id}`, v),
    '루틴을 수정했어요.'
  )

export const useDeleteRoutine = () =>
  useGoalMutation((id: number) => api.delete(`/v1/routines/${id}`), '루틴을 삭제했어요.')

// ─── 마일스톤 ────────────────────────────────────────────────

export interface MilestoneInput {
  title: string
  description: string
  dueDate: string
  targetValue: number | null
}

export const useCreateMilestone = (goalId: number) =>
  useGoalMutation(
    (v: MilestoneInput) => api.post<MilestoneInfo>(`/v1/goal-categories/${goalId}/milestones`, v),
    '마일스톤을 추가했어요.'
  )

export const useUpdateMilestone = () =>
  useGoalMutation(
    ({
      id,
      ...v
    }: Partial<MilestoneInput> & { id: number; clearTargetValue?: boolean; status?: 'ACHIEVED' | 'PENDING' }) =>
      api.patch<MilestoneInfo>(`/v1/milestones/${id}`, v),
    (v) =>
      v.status === 'ACHIEVED'
        ? '마일스톤을 달성했어요. 🎉'
        : v.status === 'PENDING'
          ? '달성을 취소했어요.'
          : '마일스톤을 수정했어요.'
  )

export const useDeleteMilestone = () =>
  useGoalMutation((id: number) => api.delete(`/v1/milestones/${id}`), '마일스톤을 삭제했어요.')

// ─── Task ───────────────────────────────────────────────────

export interface GoalTaskInput {
  taskName: string
  emoji: string | null
  generalCategoryId: number
  milestoneId: number | null
  /** "YYYY-MM-DD" */
  date: string
  /** "HH:mm" — 둘 다 있거나 둘 다 null. 없으면 그날 "시간 미정"으로 두고 자동 배치가 시간을 정해요 */
  startTime: string | null
  endTime: string | null
  durationMinutes: number | null
  dueDate: string | null
}

export const useCreateGoalTask = (goalId: number) =>
  useGoalMutation(
    (v: GoalTaskInput) => api.post<TimeBlockTask>(`/v1/goal-categories/${goalId}/tasks`, v),
    'Task를 추가했어요.'
  )

export const useUpdateGoalTask = (goalId: number) =>
  useGoalMutation(
    ({ taskId, ...v }: GoalTaskInput & { taskId: number }) =>
      api.put<TimeBlockTask>(`/v1/goal-categories/${goalId}/tasks/${taskId}`, v),
    'Task를 수정했어요.'
  )

export const useDeleteGoalTask = () =>
  useGoalMutation((taskId: number) => api.delete(`/v1/tasks/${taskId}`), 'Task를 삭제했어요.')
