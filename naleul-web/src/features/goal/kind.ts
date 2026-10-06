/**
 * 목표 카테고리 2단계 (명세 6.A.1.2) — 백엔드 GoalType / GoalSubType 과 같은 값.
 *
 * 1단계: 건강 / 학습·자기개발 / 생활습관 / 기타
 * 2단계: 건강(운동·다이어트·물 마시기·금주·금연·기타) …
 * "기타"는 이름을 직접 적어요 (공백 포함 최대 10자).
 *
 * AI 목표 설계는 고른 2단계에 맞는 가이드로 계획을 짜요 (운동이면 세션별 종목·세트, 다이어트면 운동+식단 원칙…).
 */
export type GoalType = 'HEALTH' | 'LEARNING' | 'HABIT' | 'ETC'
export type GoalSubType =
  | 'EXERCISE'
  | 'DIET'
  | 'WATER'
  | 'NO_ALCOHOL'
  | 'NO_SMOKING'
  | 'HEALTH_OTHER'
  | 'LANGUAGE'
  | 'CERTIFICATE'
  | 'READING'
  | 'CODING'
  | 'LEARNING_OTHER'
  | 'WAKE_UP'
  | 'SLEEP'
  | 'MEDITATION'
  | 'CLEANING'
  | 'JOURNAL'
  | 'OTHER'

export interface GoalKindValue {
  goalType: GoalType
  goalSubType: GoalSubType
  /** "기타"일 때만 (1~10자) */
  goalKindLabel?: string
}

export const KIND_LABEL_MAX = 10

interface SubOption {
  value: GoalSubType
  label: string
  emoji: string
  custom?: boolean
  /** 시작 화면 예시 문장 */
  examples: string[]
}

export const GOAL_TYPES: { value: GoalType; label: string; emoji: string; hint: string; subs: SubOption[] }[] = [
  {
    value: 'HEALTH',
    label: '건강',
    emoji: '💪',
    hint: '운동 · 다이어트 · 금연',
    subs: [
      {
        value: 'EXERCISE',
        label: '운동',
        emoji: '🏋️',
        examples: ['주 3회 헬스로 근력 키우기', '3개월 안에 5km 30분 안에 뛰기'],
      },
      { value: 'DIET', label: '다이어트', emoji: '🥗', examples: ['2주 동안 3kg 감량하기', '3개월에 8kg 빼기'] },
      { value: 'WATER', label: '물 마시기', emoji: '💧', examples: ['하루 물 2L 마시기'] },
      { value: 'NO_ALCOHOL', label: '금주', emoji: '🚱', examples: ['한 달 동안 술 끊기', '술은 주 1회 이하로'] },
      {
        value: 'NO_SMOKING',
        label: '금연',
        emoji: '🚭',
        examples: ['다음 달부터 완전히 금연하기', '하루 10개비에서 0개비로'],
      },
      { value: 'HEALTH_OTHER', label: '기타', emoji: '✏️', custom: true, examples: [] },
    ],
  },
  {
    value: 'LEARNING',
    label: '학습·자기개발',
    emoji: '📚',
    hint: '언어 · 자격증 · 독서 · 코딩',
    subs: [
      {
        value: 'LANGUAGE',
        label: '언어',
        emoji: '🗣️',
        examples: ['토익 900점 받기', '6개월 안에 일본어로 일상 회화하기'],
      },
      { value: 'CERTIFICATE', label: '자격증', emoji: '📜', examples: ['정보처리기사 필기 합격하기', '컴활 1급 따기'] },
      { value: 'READING', label: '독서', emoji: '📖', examples: ['올해 책 12권 읽기', '한 달에 2권 읽기'] },
      {
        value: 'CODING',
        label: '코딩',
        emoji: '💻',
        examples: ['백준 골드 달성하기', '3개월 안에 포트폴리오 앱 완성하기'],
      },
      { value: 'LEARNING_OTHER', label: '기타', emoji: '✏️', custom: true, examples: [] },
    ],
  },
  {
    value: 'HABIT',
    label: '생활습관',
    emoji: '🌱',
    hint: '기상 · 취침 · 명상 · 청소 · 일기',
    subs: [
      { value: 'WAKE_UP', label: '기상', emoji: '🌅', examples: ['매일 아침 6시 30분에 일어나기'] },
      { value: 'SLEEP', label: '취침', emoji: '🌙', examples: ['자정 전에 잠들기'] },
      { value: 'MEDITATION', label: '명상', emoji: '🧘', examples: ['매일 10분 명상하기'] },
      { value: 'CLEANING', label: '청소', emoji: '🧹', examples: ['방을 매일 깔끔하게 유지하기'] },
      { value: 'JOURNAL', label: '일기', emoji: '📝', examples: ['매일 자기 전 일기 쓰기'] },
    ],
  },
  {
    value: 'ETC',
    label: '기타',
    emoji: '✨',
    hint: '직접 적기',
    subs: [{ value: 'OTHER', label: '기타', emoji: '✏️', custom: true, examples: [] }],
  },
]

export const typeOption = (t: GoalType) => GOAL_TYPES.find((o) => o.value === t)!
export const subOption = (s: GoalSubType) => GOAL_TYPES.flatMap((t) => t.subs).find((o) => o.value === s)!

/** 입력이 끝났는지 (기타면 이름 1~10자) */
export function isKindComplete(v: GoalKindValue | null): v is GoalKindValue {
  if (!v) return false
  if (!subOption(v.goalSubType)?.custom) return true
  const label = v.goalKindLabel?.trim() ?? ''
  return label.length > 0 && label.length <= KIND_LABEL_MAX
}

/** "건강 · 다이어트", "기타 · 악기 연습" */
export function kindName(v: Pick<GoalKindValue, 'goalType' | 'goalSubType' | 'goalKindLabel'> | null | undefined) {
  if (!v?.goalType) return null
  const type = typeOption(v.goalType)
  const sub = v.goalSubType ? subOption(v.goalSubType) : null
  const subLabel = sub?.custom ? v.goalKindLabel?.trim() || sub.label : sub?.label
  return subLabel ? `${type.label} · ${subLabel}` : type.label
}

/** API 요청 바디용 (기타가 아니면 이름은 보내지 않아요) */
export function kindBody(v: GoalKindValue | null) {
  if (!v) return {}
  return {
    goalType: v.goalType,
    goalSubType: v.goalSubType,
    ...(subOption(v.goalSubType)?.custom ? { goalKindLabel: v.goalKindLabel?.trim() } : {}),
  }
}
