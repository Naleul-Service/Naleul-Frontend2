import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, isApiError } from '@/lib/client/api'
import { toast } from '@/stores/toastStore'
import type {
  LifePattern,
  MonthlyTimetableResponse,
  ReplanResponse,
  TaskScheduleResponse,
  TimeBlockTask,
  TimetableResponse,
} from './types'

export const timetableKeys = {
  all: ['timetable'] as const,
  range: (start: string, end: string) => [...timetableKeys.all, start, end] as const,
  // 'timetable' 아래에 둬서 Task 를 바꾸면 월간도 같이 다시 불러와요
  monthly: (year: number, month: number) => [...timetableKeys.all, 'monthly', year, month] as const,
}

/** GET /timetable/monthly?year&month */
export function useMonthlyTimetable(year: number, month: number) {
  return useQuery({
    queryKey: timetableKeys.monthly(year, month),
    queryFn: () => api.get<MonthlyTimetableResponse>(`/v1/timetable/monthly?year=${year}&month=${month}`),
    placeholderData: (prev) => prev,
  })
}

/** GET /timetable?startDate&endDate (최대 7일) */
export function useTimetable(start: string, end: string) {
  return useQuery({
    queryKey: timetableKeys.range(start, end),
    queryFn: () => api.get<TimetableResponse>(`/v1/timetable?startDate=${start}&endDate=${end}`),
    // 주를 넘길 때 이전 화면을 유지해서 깜빡이지 않게
    placeholderData: (prev) => prev,
  })
}

const errorMessage = (e: unknown, fallback = '문제가 생겼어요. 다시 시도해 주세요.') =>
  isApiError(e) ? e.message : fallback

/**
 * 캘린더에서 하는 모든 변경은 끝나면 TimeTable 을 다시 불러와요.
 * (밀려난 블록·덮인 고정 시간·실행률이 같이 바뀌므로 부분 수정보다 다시 조회가 안전)
 */
function useTimetableMutation<V, R>(fn: (v: V) => Promise<R>, opts: { success?: (r: R, v: V) => string | null } = {}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (r, v) => {
      const msg = opts.success?.(r, v)
      if (msg) toast.success(msg)
    },
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => qc.invalidateQueries({ queryKey: timetableKeys.all }),
  })
}

export function useToggleComplete() {
  return useTimetableMutation(
    (task: Pick<TimeBlockTask, 'taskId' | 'taskStatus'>) =>
      api.patch(`/v1/tasks/${task.taskId}/${task.taskStatus === 'COMPLETED' ? 'cancel-complete' : 'complete'}`),
    { success: (_, t) => (t.taskStatus === 'COMPLETED' ? '완료를 취소했어요.' : '완료했어요.') }
  )
}

/**
 * 완료 + 실제 시각 기록 ("계획과 다른 시간에 했어요").
 * PATCH /task-actuals/{taskId}/actual 은 실제 시각을 저장하면서 완료 처리도 같이 해요.
 * 실제 시각을 남기지 않은 완료는 "계획한 시각에 했다"고 보고 나의 패턴을 계산해요.
 */
export function useCompleteWithActual() {
  return useTimetableMutation(
    (v: { taskId: number; actualStartAt: string; actualEndAt: string }) =>
      api.patch(`/v1/task-actuals/${v.taskId}/actual`, { actualStartAt: v.actualStartAt, actualEndAt: v.actualEndAt }),
    { success: () => '완료했어요. 실제로 한 시간도 남겼어요.' }
  )
}

export function useDeleteTask() {
  return useTimetableMutation((taskId: number) => api.delete(`/v1/tasks/${taskId}`), {
    success: () => '삭제했어요.',
  })
}

export function useUnlockTask() {
  return useTimetableMutation((taskId: number) => api.patch<TimeBlockTask>(`/v1/tasks/${taskId}/unlock`), {
    success: () => '잠금을 풀었어요. 다음 자동 배치 때 옮겨질 수 있어요.',
  })
}

export function useUnscheduleTask() {
  return useTimetableMutation((taskId: number) => api.delete<TimeBlockTask>(`/v1/tasks/${taskId}/schedule`), {
    success: () => '시간 미정으로 옮겼어요.',
  })
}

/** 시간 변경 (드래그·직접 입력 공통). 저장하면 잠겨요. */
export function useRescheduleTask() {
  return useTimetableMutation(
    (v: { taskId: number; plannedStartAt: string; plannedEndAt: string }) =>
      api.patch<TaskScheduleResponse>(`/v1/tasks/${v.taskId}/schedule`, {
        plannedStartAt: v.plannedStartAt,
        plannedEndAt: v.plannedEndAt,
      }),
    { success: (r) => scheduleResultMessage(r) }
  )
}

/** 드래그 결과 안내 문장: 밀려난 블록 · 덮은 고정 시간 */
export function scheduleResultMessage(r: TaskScheduleResponse | null) {
  if (!r) return '시간을 바꿨어요.'
  const parts: string[] = []
  if (r.coveredFixedBlocks?.length) parts.push(`${r.coveredFixedBlocks.map((c) => c.title).join('·')} 시간을 덮었어요`)
  if (r.moved?.length) parts.push(`${r.moved.length}개 블록을 다른 시간으로 옮겼어요`)
  if (r.unscheduled?.length) parts.push(`${r.unscheduled.length}개는 빈 시간이 없어 시간 미정이 됐어요`)
  return parts.length ? `시간을 바꿨어요 · ${parts.join(', ')}.` : '시간을 바꿨어요.'
}

/** 고정 시간 — 그날만 변경 / 비우기 / 되돌리기 */
export function usePatternOverride() {
  return useTimetableMutation(
    (v: { lifePatternId: number; targetDate: string; startTime?: string; endTime?: string; skipped?: boolean }) =>
      api.put(`/v1/life-patterns/${v.lifePatternId}/overrides/${v.targetDate}`, {
        startTime: v.startTime,
        endTime: v.endTime,
        skipped: v.skipped,
      }),
    { success: (_, v) => (v.skipped ? '이날만 비웠어요.' : '이날만 시간을 바꿨어요.') }
  )
}

export function useDeletePatternOverride() {
  return useTimetableMutation(
    (v: { lifePatternId: number; targetDate: string }) =>
      api.delete(`/v1/life-patterns/${v.lifePatternId}/overrides/${v.targetDate}`),
    { success: () => '기본 시간으로 되돌렸어요.' }
  )
}

export const lifePatternKeys = { list: ['life-patterns'] as const }

/** 기본 생활 패턴 목록 */
export function useLifePatterns(enabled = true) {
  return useQuery({
    queryKey: lifePatternKeys.list,
    queryFn: async () => (await api.get<LifePattern[]>('/v1/life-patterns')) ?? [],
    enabled,
    staleTime: 5 * 60_000,
  })
}

/**
 * "다시 배치" — 그날의 자동 배치 블록과 시간 미정 Task 를 다시 놓아요 (잠긴 블록은 그대로).
 * 지난 날짜는 400 이라 오늘 이후만 보내요.
 */
export function useReplan() {
  return useTimetableMutation(
    async (dates: string[]) => {
      const out: ReplanResponse[] = []
      for (const d of dates) out.push(await api.post<ReplanResponse>(`/v1/daily-plans/${d}/replan`))
      return out
    },
    {
      success: (res) => {
        const n = res.reduce((sum, r) => sum + r.placed.length + r.movedToOtherDays.length, 0)
        return n ? `${n}개 블록을 다시 배치했어요.` : '다시 배치할 블록이 없었어요.'
      },
    }
  )
}
