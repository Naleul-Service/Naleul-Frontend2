import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, isApiError } from '@/lib/client/api'
import { toast } from '@/stores/toastStore'
import { timetableKeys } from '@/features/timetable/api'
import type { TimeBlockTask } from '@/features/timetable/types'
import type { GoalSubType, GoalType } from './kind'

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
  /** 하는 방법 (AI 루틴: "스쿼트 4x10, 런지 3x12…") */
  description?: string | null
  durationMinutes?: number | null
  /** 기본 시간과 다른 요일만 (예: 수요일만 07:00~07:25). 비어 있으면 모든 요일이 repeatStartTime~repeatEndTime */
  dayTimes?: RoutineDayTime[]
}

/** 요일별 시간 — "HH:mm" 또는 "HH:mm:ss" */
export interface RoutineDayTime {
  dayOfWeek: JavaDayOfWeek
  startTime: string
  endTime: string
}

export interface SubGoalInfo {
  generalCategoryId: number
  generalCategoryName: string
  colorCode: string | null
  generalCategoryStartDate: string | null
  generalCategoryEndDate: string | null
  generalCategoryStatus: GoalStatus
  routines: RoutineSummary[]
  /** 세부 목표의 실천 원칙 (AI: "하루 1,600kcal, 단백질 90g…") */
  description?: string | null
  emoji?: string | null
  /** 목표의 "기타 할 일" 그릇 — 영역을 안 고른 루틴·Task 가 들어가요. 화면에선 영역으로 보여주지 않아요 */
  defaultBucket?: boolean
}

export interface MilestoneInfo {
  milestoneId: number
  title: string
  description: string | null
  dueDate: string
  targetValue: number | null
  /** 사용자가 이 시점 수치를 직접 정했는지 (false = 시작값 → 목표값 직선에서 자동 계산) */
  targetValueManual?: boolean
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
  /** Brain dump 에서 자동으로 만든 임시 목표 (종료일·마일스톤 없음) → "AI로 구체화하기"를 권해요 */
  temporary?: boolean
  /** 목표 형태: ACHIEVEMENT 달성형(기본) / RECORD 기록형 — 회사 업무처럼 종료일·수치 없이 "한 일"을 쌓는 목표 */
  goalMode?: 'ACHIEVEMENT' | 'RECORD'
  /** 목표 카테고리 2단계 (명세 6.A.1.2). 예전 목표는 null */
  goalType?: GoalType | null
  goalSubType?: GoalSubType | null
  goalKindLabel?: string | null
  /** "건강 · 다이어트" */
  goalKindName?: string | null
  planningStyle?: 'PLANNER' | 'SPONTANEOUS' | null
  aiNote?: string | null
  metricName?: string | null
  metricUnit?: string | null
  startValue?: number | null
  currentValue?: number | null
  targetValue?: number | null
  milestones?: MilestoneInfo[] | null
}

/** 기록형 목표인지 (예전 응답엔 goalMode 가 없어서 undefined = 달성형) */
export const isRecordGoal = (g: Pick<GoalCategory, 'goalMode'> | null | undefined) => g?.goalMode === 'RECORD'

export const goalKeys = {
  all: ['goals'] as const,
  list: () => [...goalKeys.all, 'list'] as const,
  detail: (id: number) => [...goalKeys.all, 'detail', id] as const,
  tasks: (id: number) => [...goalKeys.all, 'tasks', id] as const,
  progress: (id: number) => [...goalKeys.all, 'progress', id] as const,
  heatmap: (id: number) => [...goalKeys.all, 'heatmap', id] as const,
}

export function useGoalCategories() {
  return useQuery({
    queryKey: goalKeys.list(),
    // 삭제된 목표는 혹시 내려와도 화면에서 제외
    queryFn: async () =>
      ((await api.get<GoalCategory[]>('/v1/goal-categories')) ?? []).filter((g) => g.goalCategoryStatus !== 'DELETED'),
  })
}

export function useGoalCategory(id: number, enabled = true) {
  return useQuery({
    queryKey: goalKeys.detail(id),
    queryFn: () => api.get<GoalCategory>(`/v1/goal-categories/${id}`),
    enabled,
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
      qc.invalidateQueries({ queryKey: goalKeys.progress(goalId) })
      qc.invalidateQueries({ queryKey: goalKeys.heatmap(goalId) })
      qc.invalidateQueries({ queryKey: timetableKeys.all })
    },
  })
}

// ─── 루틴 실천 히트맵 ──────────────────────────────────────────

/** GET /routines/{goalId}/heatmap — 루틴마다 반복 요일 · 기간 · 완료한 날짜 */
export interface RoutineHeatmap {
  routineId: number
  routineName: string
  repeatStartDate: string
  repeatEndDate: string | null
  /** "MONDAY" … */
  repeatDays: JavaDayOfWeek[]
  /** 루틴 Task 를 완료한 날짜 "YYYY-MM-DD" */
  completedDates: string[]
  currentStreak: number
  longestStreak: number
}

export function useRoutineHeatmap(goalId: number) {
  return useQuery({
    queryKey: goalKeys.heatmap(goalId),
    queryFn: async () => (await api.get<RoutineHeatmap[]>(`/v1/routines/${goalId}/heatmap`)) ?? [],
  })
}

// ─── 진행 도표 ("지금 어디쯤?") ───────────────────────────────────

export type ProgressStatus = 'NOT_STARTED' | 'AHEAD' | 'ON_TRACK' | 'BEHIND' | 'ACHIEVED' | 'NO_PLAN'

export interface ProgressPoint {
  date: string
  value: number
  /** "시작" · 마일스톤 제목 · "목표" */
  label: string | null
}

export interface MetricLog {
  date: string
  value: number
  memo: string | null
}

/** 수치 목표(체중 72 → 69kg 등)의 계획선 · 기록 · 오늘 위치 */
export interface MetricProgress {
  name: string | null
  unit: string | null
  startValue: number
  targetValue: number
  currentValue: number
  /** 계획대로라면 오늘 값 (종료일 없으면 null) */
  expectedValue: number | null
  /** (현재-시작)/(목표-시작)×100 — 음수·100 초과 가능 */
  progressPercent: number | null
  status: ProgressStatus
  /** 최근 기록 추세대로면 목표 도달 예상일 */
  projectedDate: string | null
  lastLoggedDate: string | null
  loggedToday: boolean
  planLine: ProgressPoint[]
  logs: MetricLog[]
}

export interface TaskProgressPoint {
  date: string
  /** 그날까지 하기로 한 Task 누적 */
  planned: number
  /** 그날까지 완료한 Task 누적 (오늘 이후는 null) */
  completed: number | null
}

export interface TaskProgress {
  total: number
  completed: number
  /** 오늘까지 하기로 한 Task (이미 끝낸 Task 포함) */
  dueByToday: number
  completionPercent: number | null
  series: TaskProgressPoint[]
}

export interface GoalProgress {
  goalCategoryId: number
  today: string
  startDate: string | null
  endDate: string | null
  elapsedDays: number
  totalDays: number | null
  metric: MetricProgress | null
  tasks: TaskProgress
  /** 최근 하루 회고 (최신순) */
  reflections?: GoalReflection[]
}

/** 그날 목표를 돌아본 느낌 */
export type ReflectionMood = 'GOOD' | 'OK' | 'BAD'

/** 하루 회고: 무엇을 했는지 · 어땠는지 (예: "점심에 마라탕 먹음" · 아쉬워요) */
export interface GoalReflection {
  date: string
  mood: ReflectionMood | null
  note: string | null
}

export function useGoalProgress(goalId: number, enabled = true) {
  return useQuery({
    queryKey: goalKeys.progress(goalId),
    queryFn: () => api.get<GoalProgress>(`/v1/goal-categories/${goalId}/progress`),
    enabled,
  })
}

/**
 * 수치 기록 (같은 날짜는 덮어써요). 응답이 진행 데이터 전체라 도표는 바로 다시 그려요.
 * 목표의 현재 값도 바뀌니 목표 상세 · 목록도 다시 불러와요.
 */
export function useRecordMetric(goalId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { date?: string; value: number; memo?: string | null }) =>
      api.put<GoalProgress>(`/v1/goal-categories/${goalId}/metric-logs`, body),
    onSuccess: (data) => {
      qc.setQueryData(goalKeys.progress(goalId), data)
      toast.success('기록했어요.')
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : '기록하지 못했어요. 다시 시도해 주세요.'),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: goalKeys.detail(goalId) })
      qc.invalidateQueries({ queryKey: goalKeys.list() })
    },
  })
}

/**
 * 오늘 기록 + 회고 한 번에 (수치는 수치 목표일 때만 저장돼요).
 * mood·note 를 모두 비우면 그날 회고를 지워요.
 */
export function useCheckIn(goalId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { date?: string; value?: number | null; mood?: ReflectionMood | null; note?: string | null }) =>
      api.put<GoalProgress>(`/v1/goal-categories/${goalId}/check-in`, body),
    onSuccess: (data) => {
      qc.setQueryData(goalKeys.progress(goalId), data)
      toast.success('오늘 기록을 남겼어요.')
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : '기록하지 못했어요. 다시 시도해 주세요.'),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: goalKeys.detail(goalId) })
      qc.invalidateQueries({ queryKey: goalKeys.list() })
    },
  })
}

export function useDeleteMetricLog(goalId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (date: string) => api.delete<GoalProgress>(`/v1/goal-categories/${goalId}/metric-logs/${date}`),
    onSuccess: (data) => {
      qc.setQueryData(goalKeys.progress(goalId), data)
      toast.success('기록을 지웠어요.')
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : '지우지 못했어요. 다시 시도해 주세요.'),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: goalKeys.detail(goalId) })
      qc.invalidateQueries({ queryKey: goalKeys.list() })
    },
  })
}
