import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, isApiError } from '@/lib/client/api'
import { toast } from '@/stores/toastStore'
import type { GoalMode } from '@/features/goal/api'
import { workKeys } from '@/features/work/api'

/**
 * 홈 "오늘" (백엔드 GET /api/v1/home/today)
 *  - 다가오는 마감: Task 마감 · 업무형 주제 마감(V53) · 목표형 종료일
 *  - 진행 중인 목표별 오늘: 끝낸 일 · 못 한 일 · 오늘 쓴 회고
 * 오늘 일정 · 루틴 Task 는 /timetable, 생활 습관은 /habits 를 그대로 써요.
 */

export type DeadlineType = 'TASK' | 'TOPIC' | 'GOAL'

export interface HomeDeadline {
  type: DeadlineType
  /** taskId · workTopicId · goalCategoryId */
  id: number
  title: string
  emoji: string | null
  date: string
  /** 오늘 0, 지났으면 음수 */
  dDay: number
  overdue: boolean
  goalCategoryId: number | null
  goalName: string | null
  goalEmoji: string | null
  colorCode: string | null
  goalMode: GoalMode | null
  /** TOPIC: 그 주제의 남은 Task 수 */
  remaining: number | null
}

export interface HomeRetro {
  retrospectiveId: number
  reviewType: 'DAILY' | 'WEEKLY' | 'MONTHLY' | null
  content: string
}

export interface HomeGoalToday {
  goalCategoryId: number
  goalName: string
  emoji: string | null
  colorCode: string | null
  goalMode: GoalMode | null
  /** 오늘 할 일 · 끝낸 일 · 회고가 하나라도 있으면 true */
  activeToday: boolean
  planned: number
  done: number
  doneTasks: string[]
  openTasks: string[]
  retros: HomeRetro[]
}

export interface HomeToday {
  today: string
  deadlines: HomeDeadline[]
  goals: HomeGoalToday[]
}

export const homeKeys = {
  all: ['home'] as const,
  today: () => [...homeKeys.all, 'today'] as const,
}

export function useHomeToday() {
  return useQuery({
    queryKey: homeKeys.today(),
    queryFn: () => api.get<HomeToday>('/v1/home/today'),
    // 아직 배포 전인 서버(404)에서도 홈의 나머지는 보여야 해서 재시도하지 않아요
    retry: false,
  })
}

const errorMessage = (e: unknown) => (isApiError(e) ? e.message : '문제가 생겼어요. 다시 시도해 주세요.')

function useRetroMutation<V>(fn: (v: V) => Promise<unknown>, success: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => toast.success(success),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: homeKeys.all })
      // 업무형 보드의 회고 목록도 같이 바뀌어요
      qc.invalidateQueries({ queryKey: workKeys.all })
    },
  })
}

/** 오늘 회고 남기기 (POST /retrospectives · DAILY) */
export const useCreateTodayRetro = () =>
  useRetroMutation(
    (v: { goalCategoryId: number; content: string; date: string }) =>
      api.post('/v1/retrospectives', {
        reviewType: 'DAILY',
        reviewDate: v.date,
        content: v.content,
        goalCategoryId: v.goalCategoryId,
      }),
    '회고를 남겼어요.'
  )

export const useUpdateRetro = () =>
  useRetroMutation(
    (v: { retrospectiveId: number; content: string }) =>
      api.patch(`/v1/retrospectives/${v.retrospectiveId}`, { content: v.content }),
    '회고를 고쳤어요.'
  )

export const useDeleteRetro = () =>
  useRetroMutation((retrospectiveId: number) => api.delete(`/v1/retrospectives/${retrospectiveId}`), '회고를 지웠어요.')
