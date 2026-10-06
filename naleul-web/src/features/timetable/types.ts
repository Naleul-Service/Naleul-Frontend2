/**
 * TimeTable API 응답 타입 (백엔드 BE-2/4/6 DTO 와 1:1)
 *
 * ⚠️ 날짜/시간 문자열은 모두 "한국 시간 벽시계" 값이에요. (Z, +09:00 없음)
 *   - LocalDate      → "2026-11-18"
 *   - LocalDateTime  → "2026-11-18T09:30:00"
 *   - LocalTime      → "09:30:00"
 *   브라우저 Date 로 바꾸면 사용자 PC 시간대에 따라 어긋나므로, 문자열 그대로 계산해요. (time.ts)
 */
import type { JavaDayOfWeek } from '@/features/goal/api'

export type LifePatternType = 'SLEEP' | 'LUNCH' | 'DINNER' | 'CUSTOM'
export type TaskStatus = 'TODO' | 'COMPLETED' | 'SKIPPED' | 'DELETED'
export type TaskPriority = 'A' | 'B' | 'C' | 'D' | 'E'
export type TaskKind = 'NORMAL' | 'APPOINTMENT'
export type TaskSourceType = 'MANUAL' | 'ROUTINE' | 'MISSION'
export type PlacedBy = 'USER' | 'ENGINE'
export type DailyPlanStatus = 'GENERATING' | 'GENERATED' | 'REVIEWED' | 'FAILED'
export type DailyPlanSource = 'NIGHTLY' | 'BRAIN_DUMP' | 'REPLAN' | 'GOAL_CREATED'

export interface TimeBlockTask {
  taskId: number
  taskName: string
  emoji?: string | null
  taskStatus: TaskStatus
  taskPriority?: TaskPriority | null
  taskKind?: TaskKind | null
  sourceType: TaskSourceType
  source?: string | null
  goalCategoryId?: number | null
  goalCategoryName?: string | null
  goalEmoji?: string | null
  goalColorCode?: string | null
  goalTemporary: boolean
  generalCategoryId?: number | null
  generalCategoryName?: string | null
  milestoneId?: number | null
  milestoneTitle?: string | null
  routineId?: number | null
  date?: string | null
  plannedStartAt?: string | null
  plannedEndAt?: string | null
  plannedDurationMinutes?: number | null
  scheduledDate?: string | null
  dueDate?: string | null
  locked: boolean
  placedBy?: PlacedBy | null
  placementReason?: string | null
  placementReasonCodes?: string[]
  carryOverCount: number
  completedAt?: string | null
  /** 완료한 Task 의 실제 수행 시각 (완료 전이거나 실제 시각 기록이 없으면 null) */
  actualStartAt?: string | null
  actualEndAt?: string | null
  missed: boolean
}

export interface Covered {
  taskId: number
  start: string
  end: string
}

export interface FixedBlock {
  lifePatternId: number
  patternType: LifePatternType
  title: string
  emoji?: string | null
  /** 그날만 변경 API 에 넘길 날짜 (자정을 넘긴 수면의 다음 날 부분이어도 전날) */
  targetDate: string
  start: string
  end: string
  overridden: boolean
  clippedFromPreviousDay: boolean
  coveredBy?: Covered[]
}

export interface DayPlan {
  status: DailyPlanStatus
  source: DailyPlanSource
  summary?: string | null
  needsReview: boolean
  generatedAt?: string | null
}

export interface DayStats {
  total: number
  completed: number
  missed: number
  /** 완료/전체 × 100. Task 가 없으면 null */
  rate?: number | null
}

export interface TimetableDay {
  date: string
  dayRange: { start: string; end: string }
  fixedBlocks: FixedBlock[]
  tasks: TimeBlockTask[]
  unscheduledTasks: TimeBlockTask[]
  plan?: DayPlan | null
  stats: DayStats
}

export interface TimetableResponse {
  days: TimetableDay[]
}

export interface TaskScheduleResponse {
  task: TimeBlockTask
  moved: { taskId: number; fromStart: string; toStart: string; toEnd: string; reason?: string | null }[]
  unscheduled: number[]
  coveredFixedBlocks: { lifePatternId: number; title: string }[]
}

export interface LifePattern {
  lifePatternId: number
  patternType: LifePatternType
  title: string
  emoji?: string | null
  startTime: string
  endTime: string
  days: JavaDayOfWeek[]
  everyDay: boolean
  crossesMidnight: boolean
  sortOrder: number
}

/** GET /timetable/monthly (명세 5-2) */
export interface MonthlyChip {
  taskId: number
  title: string
  colorCode?: string | null
  completed: boolean
  temporaryGoal: boolean
}

export interface MonthlyMilestoneChip {
  milestoneId: number
  title: string
  colorCode?: string | null
  goalCategoryId: number
}

export interface MonthlyDay {
  date: string
  /** 실행률 (Task 없으면 null) */
  rate?: number | null
  taskCount: number
  completedCount: number
  /** 루틴이 아닌 Task 최대 3개 */
  chips: MonthlyChip[]
  moreCount: number
  milestones: MonthlyMilestoneChip[]
}

export interface MonthlyDeadline {
  type: 'TASK' | 'MILESTONE'
  id: number
  title: string
  date: string
  colorCode?: string | null
}

export interface MonthlyTimetableResponse {
  year: number
  month: number
  days: MonthlyDay[]
  /** 이번 주(월~일) 마감인 미완료 Task + 마일스톤 */
  deadlinesThisWeek: MonthlyDeadline[]
}

/** GET /daily-plans/{date} (BE-6) */
export interface DailyPlanResponse {
  date: string
  exists: boolean
  status?: DailyPlanStatus | null
  source?: DailyPlanSource | null
  summary?: string | null
  needsReview: boolean
  placedCount: number
  carriedCount: number
  unplacedCount: number
  generatedAt?: string | null
  reviewedAt?: string | null
}

/** POST /daily-plans/{date}/replan */
export interface ReplanResponse {
  plan: DailyPlanResponse
  placed: { taskId: number; date: string; start: string; end: string; reason?: string | null }[]
  movedToOtherDays: { taskId: number; date: string; start: string; end: string; reason?: string | null }[]
  unscheduled: number[]
}

/**
 * 실제로 한 일 (GET /activities) — 계획(Task)과 상관없이 그 시간에 실제로 한 활동.
 * TimeTable 에서 계획 블록 옆 "실제" 칸에 그려요. 시각은 한국 시간 "YYYY-MM-DDTHH:mm:ss".
 */
export interface ActualActivity {
  activityId: number
  title: string
  emoji: string | null
  startAt: string
  endAt: string
  durationMinutes: number
  goalCategoryId: number | null
  goalCategoryName: string | null
  goalColorCode: string | null
  /** 원래 이 시간에 계획했던 Task (선택) */
  replacedTaskId: number | null
  replacedTaskName: string | null
  memo: string | null
}

export interface ActivityInput {
  title: string
  emoji?: string | null
  startAt: string
  endAt: string
  goalCategoryId?: number | null
  replacedTaskId?: number | null
  memo?: string | null
}
