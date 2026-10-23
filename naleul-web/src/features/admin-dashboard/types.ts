/**
 * 운영 대시보드 (GET /api/v1/admin/dashboard) 응답 타입.
 * 백엔드 AdminDashboardResponse 와 1:1. 비율(%)이 null 이면 "분모가 0" — 0% 와 구분해서 '–' 로 보여줘요.
 */

export interface AdminDashboard {
  period: { from: string; to: string; days: number; bucket: 'DAY' | 'WEEK'; generatedAt: string }
  finance: Finance
  users: DashUsers
  goals: Goals
  tasks: Execution
  routines: Execution
  aiGoalFunnel: AiGoalFunnel
  /** AI 품질 — 기능마다 ① 채택 ② 수정 ③ 결과 + 자동 판정 신뢰도 */
  aiQuality?: AiQuality
  series: DailyPoint[]
  notes: string[]
}

export interface Finance {
  revenue: Revenue
  aiCost: AiCost
  serverCost: ServerCost
  profit: Profit
}

export interface Revenue {
  grossKrw: number
  refundKrw: number
  appleFeeKrw: number
  netKrw: number
  purchaseCount: number
  renewalCount: number
  refundCount: number
  activeSubscriptions: number
  estimatedMrrKrw: number
  appleFeeRate: number
  products: ProductRow[]
  trackingSince: string | null
}

export interface ProductRow {
  productId: string
  periodPayments: number
  periodGrossKrw: number
  activeSubscriptions: number
  /** null 이면 가격을 몰라 MRR 에서 빠졌어요 */
  monthlyPriceKrw: number | null
}

export interface AiCost {
  usd: number
  krw: number
  usdKrw: number
  calls: number
  failedCalls: number
  inputTokens: number
  outputTokens: number
  cacheWriteTokens: number
  cacheReadTokens: number
  byFeature: AiFeatureRow[]
  byModel: AiModelRow[]
  unpricedModels: string[]
  trackingSince: string | null
}

export interface AiFeatureRow {
  feature: string
  label: string
  calls: number
  failedCalls: number
  inputTokens: number
  outputTokens: number
  usd: number
  krw: number
  avgUsdPerCall: number | null
}

export interface AiModelRow {
  model: string
  calls: number
  inputTokens: number
  outputTokens: number
  usd: number
  krw: number
}

export interface ServerCost {
  monthlyKrw: number
  periodKrw: number
  items: { name: string; monthlyKrw: number; periodKrw: number }[]
}

export interface Profit {
  netRevenueKrw: number
  totalCostKrw: number
  profitKrw: number
  aiCostPerActiveUserKrw: number | null
  costPerActiveUserKrw: number | null
}

export interface DashUsers {
  total: number
  pro: number
  proRatePercent: number | null
  active7d: number
  active30d: number
  activeInPeriod: number
  withActiveGoal: number
}

export interface Goals {
  ended: number
  achieved: number
  partial: number
  notAchieved: number
  /** 달성 / 끝난 목표 — 핵심 지표 */
  achievementRate: number | null
  successRate: number | null
  inProgress: number
  avgExecutionRate: number | null
  onTrackRate: number | null
  /** 실천률 0–19 · 20–39 · 40–59 · 60–79 · 80–100 구간별 목표 수 */
  executionHistogram: number[]
  byType: GoalGroupRow[]
  bySource: GoalGroupRow[]
}

export interface GoalGroupRow {
  key: string
  label: string
  ended: number
  achieved: number
  partial: number
  achievementRate: number | null
  avgRoutineRate: number | null
  avgTaskRate: number | null
}

export interface Execution {
  due: number
  completed: number
  skipped: number
  rate: number | null
  users: number
  activeItems: number
}

export interface AiGoalFunnel {
  sessions: number
  drafts: number
  confirmed: number
  abandoned: number
  conversionRate: number | null
}

export interface DailyPoint {
  date: string
  taskDue: number
  taskDone: number
  taskRate: number | null
  routineDue: number
  routineDone: number
  routineRate: number | null
  aiUsd: number
  activeUsers: number
}

/** AI 품질 (채택 · 수정 · 결과) — 백엔드 AdminDashboardResponse.AiQuality */
export interface AiQuality {
  features: AiQualityRow[]
  outcomeCheck: OutcomeCheck
}

/**
 * key: GOAL_PLAN · TIMETABLE · GOAL_EDIT · SCHEDULE_EDIT · BRAIN_DUMP · PATTERN
 * 비율은 분모(…Base)가 0 이면 null. editLabel 이 null 이면 해당 없음.
 */
export interface AiQualityRow {
  key: string
  label: string
  adoptLabel: string
  adoptRate: number | null
  adoptBase: number
  editLabel: string | null
  editRate: number | null
  editBase: number
  resultLabel: string
  resultRate: number | null
  resultBase: number
  /** ③과 비교할 기준 (적용 전 같은 기간 실천률) */
  beforeRate: number | null
  extraLabel: string | null
  extraRate: number | null
  extraBase: number
}

/** 자동 판정 신뢰도 — 결과 확인 모달 응답률 · 직접 고른 결과와의 일치율 */
export interface OutcomeCheck {
  autoJudged: number
  answered: number
  dismissed: number
  pending: number
  responseRate: number | null
  compared: number
  matched: number
  matchRate: number | null
  /** 수치 80~99% 라 자동 "달성" 처리된 목표 수 */
  metric80: number
  byReason: { reason: string; label: string; compared: number; matched: number; matchRate: number | null }[]
}
