/**
 * 나의 패턴 API 타입 (백엔드 명세 4 · 7장, PatternReportResponse)
 * 카드 하나가 계산에 실패하면 그 필드가 null 이에요. 표본이 부족한 값도 null 이라 전부 optional 로 둬요.
 */
import type { JavaDayOfWeek } from '@/features/goal/api'

export type PatternPeriod = 'RECENT_4W' | 'ALL'
export type DayGroup = 'WEEKDAY' | 'WEEKEND' | 'ALL'
export type HeatCellState = 'VALUE' | 'FIXED' | 'EMPTY'
export type SuggestionType = 'ROUTINE_TIME' | 'ROUTINE_DAY'

export interface PatternReport {
  period: PatternPeriod
  range: { start: string; end: string; days: number }
  timeBlockCount: number
  evaluatedCount: number
  generatedAt: string
  aiStatus: 'AI' | 'TEMPLATE'
  style?: PatternStyle | null
  summary?: PatternSummary | null
  heatmap?: PatternHeatmap | null
  weekday?: PatternWeekday | null
  weekly?: PatternWeekly | null
  timeUsage?: PatternTimeUsage | null
  blockKeeping?: PatternBlockKeeping | null
  routines?: PatternRoutines | null
  taskHabits?: PatternTaskHabits | null
  suggestion?: PatternSuggestionBar | null
}

/** text 안의 **…** 는 강조 */
export interface PatternInsight {
  key: string
  icon: string
  text: string
}

export interface PatternStyle {
  timeStrength?: 'MORNING' | 'DAYTIME' | 'EVENING' | 'EVEN' | null
  rhythm?: 'WEEKDAY_FOCUSED' | 'WEEKEND_RECHARGE' | 'STEADY' | 'BURST' | null
  title?: string | null
  highlight?: string | null
  insights: PatternInsight[]
  /** 스타일을 보여주려면 더 필요한 Task 수 (충분하면 null) */
  remainingForStyle?: number | null
  /** 스타일을 열기까지의 진행 — "Task 15개 · 4일 더" */
  progress?: StyleProgress | null
}

export interface StyleProgress {
  evaluated: number
  activeDays: number
  requiredTasks: number
  requiredDays: number
  remainingTasks: number
  remainingDays: number
}

export interface PatternSummary {
  executionRate?: number | null
  firstWeekDelta?: number | null
  bestStreak: number
  currentStreak: number
  avgStartDelayMinutes?: number | null
  morningDelayMinutes?: number | null
  eveningDelayMinutes?: number | null
  aiPlacementEditRate?: number | null
  aiPlacementKeptPerTen?: number | null
  engineBlockCount: number
  insufficient: string[]
}

export interface HeatCell {
  hour: number
  state: HeatCellState
  rate?: number | null
  samples?: number | null
  /** 1~5 (≤60 / ≤70 / ≤80 / ≤90 / >90) */
  level?: number | null
}

export interface TimeWindow {
  dayGroup: DayGroup
  startHour: number
  /** 포함하지 않음 (19~22 = 19, 20, 21시) */
  endHour: number
  rate: number
  samples: number
}

export interface PatternHeatmap {
  hours: number[]
  rows: { dayOfWeek: JavaDayOfWeek; cells: HeatCell[] }[]
  fixedLabel?: string | null
  goldenTime?: TimeWindow | null
  weakTime?: TimeWindow | null
}

export interface PatternWeekday {
  average?: number | null
  days: { dayOfWeek: JavaDayOfWeek; rate?: number | null; samples: number }[]
  lowest?: JavaDayOfWeek | null
  lowestMissed?: string | null
  insight?: string | null
}

export interface PatternWeekly {
  points: { index: number; weekStart: string; rate?: number | null; samples: number }[]
  maxIndex?: number | null
}

export interface PatternGoalUsage {
  goalCategoryId: number
  name: string
  emoji?: string | null
  colorCode?: string | null
  actualHoursPerWeek: number
  plannedHoursPerWeek: number
  planRatio?: number | null
  temporary: boolean
  newTemporary: boolean
}

export interface PatternTimeUsage {
  weeklyTotalHours: number
  goals: PatternGoalUsage[]
}

export interface FrequentMove {
  routineId?: number | null
  title: string
  emoji?: string | null
  fromLabel: string
  toLabel: string
  dayChange: boolean
  description: string
  count: number
}

export interface PatternBlockKeeping {
  total: number
  onTime?: number | null
  late?: number | null
  missed?: number | null
  frequentMoves: FrequentMove[]
}

export interface PatternRoutines {
  kept: { routineId: number; title: string; emoji?: string | null; rate: number; samples: number }[]
  missed: {
    routineId: number
    routineName: string
    emoji?: string | null
    label: string
    description: string
    rate: number
    samples: number
  }[]
}

export interface PatternTaskHabits {
  taskCount: number
  deadlineLeadDays?: number | null
  deadlineLabel?: string | null
  postponedRate?: number | null
  postponedTopGoal?: string | null
  brainDumpPerWeek?: number | null
  brainDumpAvgItems?: number | null
  brainDumpUsualDay?: JavaDayOfWeek | null
  brainDumpUsualLabel?: string | null
  brainDumpUsualRange?: string | null
}

export interface SuggestionChange {
  startTime?: string | null
  endTime?: string | null
  days?: JavaDayOfWeek[] | null
}

export interface PatternSuggestionItem {
  key: string
  type: SuggestionType
  routineId: number
  routineName: string
  before: SuggestionChange
  after: SuggestionChange
}

export interface PatternSuggestionBar {
  text: string
  expectedGain?: number | null
  items: PatternSuggestionItem[]
}

export interface SuggestionApplyResult {
  key: string
  type: SuggestionType
  routineId: number
  routineName: string
  before: SuggestionChange
  after: SuggestionChange
  affectedTaskCount: number
  rePlaced: { taskId: number; from: string; to: string }[]
  unscheduled: number[]
}
