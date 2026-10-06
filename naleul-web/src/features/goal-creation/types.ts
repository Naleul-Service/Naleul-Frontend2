import type { GoalSubType } from '@/features/goal/kind'
/**
 * AI 목표 생성 — 백엔드 응답 타입 (인수인계 문서 3장 기준)
 */

export type SessionStatus =
  'INTERVIEWING' | 'READY_TO_GENERATE' | 'GENERATING' | 'DRAFT_READY' | 'CONFIRMED' | 'ABANDONED'

export type SlotKey = 'goalStatement' | 'metric' | 'motivation' | 'deadline' | 'practicePreference'
export type SlotStatus = 'EMPTY' | 'FILLED' | 'SKIPPED'
export type PlanningStyle = 'PLANNER' | 'SPONTANEOUS'
export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'

export interface Slot<T> {
  status: SlotStatus
  value: T | null
}

export interface MetricValue {
  name: string
  currentValue: number | null
  targetValue: number | null
  unit: string | null
}

export interface DeadlineValue {
  endDate: string // yyyy-MM-dd
  isFlexible: boolean
}

export interface PracticePreferenceValue {
  preferredDays: DayOfWeek[] | null
  preferredTimeRanges: { start: string; end: string }[] | null
  unavailableNote: string | null
  workStyleAnswer: string | null
}

export interface GoalSlots {
  goalStatement: Slot<string>
  metric: Slot<MetricValue>
  motivation: Slot<string>
  deadline: Slot<DeadlineValue>
  practicePreference: Slot<PracticePreferenceValue>
}

export interface GoalSummary {
  goalStatement: string | null
  metricText: string | null
  motivation: string | null
  deadlineText: string | null
  preferenceText: string | null
  planningStyle: PlanningStyle | null
}

export interface GoalMessage {
  messageId: number
  role: 'USER' | 'ASSISTANT'
  content: string | null
  targetSlot?: SlotKey | null
  quickReplies?: string[] | null
  skippable?: boolean
  skip?: boolean
}

/** 세션 시작 / 답변 / 조기 종료 응답 */
export interface TurnResponse {
  sessionId: number
  status: SessionStatus
  questionCount: number
  maxQuestions: number
  canFinishEarly: boolean
  message: GoalMessage | null
  slots: GoalSlots
  summary: GoalSummary | null
}

export interface DraftRef {
  draftId: number
  version: number
  status: 'GENERATING' | 'READY' | 'FAILED'
}

/** 세션 조회 (이어하기) 응답 */
export interface SessionDetail {
  sessionId: number
  status: SessionStatus
  questionCount: number
  maxQuestions: number
  canFinishEarly: boolean
  messages: GoalMessage[]
  slots: GoalSlots
  summary: GoalSummary | null
  latestDraft: DraftRef | null
}

// ─── 슬롯 수정 (PATCH /slots) — 바꾼 것만 보냄 ───────────────────
export interface SlotsPatch {
  goalStatement?: string
  metric?: { name: string; currentValue: number | null; targetValue: number | null; unit: string | null }
  motivation?: string
  deadline?: DeadlineValue
  practicePreference?: PracticePreferenceValue
}

// ─── 초안 (GoalPlan) — 초안 응답 = 확정 요청 공통 구조 ─────────────
export type GoalCategoryType = 'HEALTH' | 'STUDY' | 'CAREER' | 'FINANCE' | 'HOBBY' | 'RELATIONSHIP' | 'LIFE' | 'ETC'
export type Comparator = 'GTE' | 'LTE' | 'EQ'
export type MetricPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'TOTAL'

export interface PlanGoal {
  title: string
  emoji: string | null
  category: GoalCategoryType
  description: string | null
  metric: { name: string; unit: string; startValue: number; targetValue: number } | null
  startDate: string
  endDate: string
  planningStyle: PlanningStyle
  aiNote: string | null
  /** 목표 카테고리 2단계 (AI 가 분류하거나 사용자가 고른 값) */
  subType?: GoalSubType | null
}

export interface PlanSubGoal {
  tempId: string
  title: string
  emoji: string | null
  description: string | null
  metric: {
    name: string
    unit: string
    comparator: Comparator
    targetValue: number
    period: MetricPeriod
  } | null
}

export interface PlanMilestone {
  tempId: string
  title: string
  description: string | null
  dueDate: string
  targetValue: number | null
}

export interface PlanTask {
  tempId: string
  type: 'ROUTINE' | 'ONE_TIME'
  subGoalTempId: string | null
  milestoneTempId: string | null
  title: string
  emoji: string | null
  durationMinutes: number
  routineDays: DayOfWeek[] | null
  preferredStartTime: string | null
  startDate: string | null
  endDate: string | null
  scheduledDate: string | null
  dueDate: string | null
  /** 루틴의 구체적인 방법 (예: "스쿼트 4x10, 런지 3x12…") */
  description?: string | null
}

export interface PlanIssue {
  ruleId: string
  path: string
  message: string
}

export interface GoalPlan {
  goal: PlanGoal
  subGoals: PlanSubGoal[]
  milestones: PlanMilestone[]
  tasks: PlanTask[]
  warnings: PlanIssue[]
}

// ─── 초안 생성 / 폴링 ─────────────────────────────────────────────
export type DraftStatus = 'GENERATING' | 'READY' | 'FAILED'
export type ProgressStep = 'ANALYZING' | 'SUB_GOALS' | 'MILESTONES' | 'TASKS' | 'VALIDATING'
export type DraftErrorCode = 'AI_PLAN_INVALID' | 'AI_TIMEOUT' | 'AI_UNAVAILABLE' | 'AI_INVALID_OUTPUT' | 'AI_BUSY'

/** POST /drafts → 202 */
export interface DraftRequested {
  draftId: number
  version: number
  status: DraftStatus
  pollAfterMs: number
}

/** GET /drafts/{draftId} */
export interface DraftResponse {
  draftId: number
  version: number
  status: DraftStatus
  planningStyle: PlanningStyle | null
  progressStep: ProgressStep | null
  pollAfterMs: number | null
  plan: GoalPlan | null
  errorCode: DraftErrorCode | null
  message: string | null
}

// ─── 확정 ─────────────────────────────────────────────────────────
export interface ConfirmRequest {
  draftId: number
  plan: GoalPlan
  planningStyleSelectedByUser: boolean
  /** 선택한 UserColor id. 생략하면 서버가 자동 배정 */
  colorId?: number
}
