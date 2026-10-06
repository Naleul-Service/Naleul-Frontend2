import { DAY_LABEL } from '../../constants'
import type { DayOfWeek, GoalPlan, PlanIssue, PlanTask } from '../../types'

// ─── 날짜 ───────────────────────────────────────────────────────

/** "2026-10-02" → 로컬 Date (new Date("2026-10-02") 는 UTC 로 해석돼 하루 밀릴 수 있어요) */
export function parseYmd(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toYmd(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

/** "2026-10-02" → "10.02 (금)" */
export function formatMd(value: string | null, withWeekday = true): string {
  if (!value) return ''
  const date = parseYmd(value)
  const md = `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
  return withWeekday ? `${md} (${WEEKDAY[date.getDay()]})` : md
}

/** "2026-10-02" → "2026.10.02" */
export const formatYmdDot = (value: string) => value.replaceAll('-', '.')

export function daysBetween(from: string, to: string): number {
  return Math.round((parseYmd(to).getTime() - parseYmd(from).getTime()) / 86_400_000)
}

/** 오늘 기준 D-day 숫자 (남은 일수) */
export function dDay(to: string): number {
  return daysBetween(toYmd(new Date()), to)
}

export function formatDays(days: DayOfWeek[] | null): string {
  if (!days?.length) return ''
  if (days.length === 7) return '매일'
  return days.map((d) => DAY_LABEL[d]).join('·')
}

// ─── 편집 헬퍼 ──────────────────────────────────────────────────

let seq = 0
/** 새로 추가하는 항목의 tempId (중복만 안 되면 돼요) */
export const newTempId = (prefix: 'sg' | 'ms' | 't') => `${prefix}-new-${Date.now().toString(36)}-${++seq}`

export const isRoutine = (t: PlanTask) => t.type === 'ROUTINE'

/** 루틴 주간 총 시간(분) */
export const weeklyRoutineMinutes = (tasks: PlanTask[]) =>
  tasks.filter(isRoutine).reduce((sum, t) => sum + t.durationMinutes * (t.routineDays?.length ?? 0), 0)

// ─── 검증 ───────────────────────────────────────────────────────
// 서버 HARD 규칙 중 프론트에서 바로 확인 가능한 것들 (인수인계 3-4).
// path 형식을 서버 violations 와 같게 맞춰서, 화면 표시 로직을 하나로 써요.

/**
 * 서버 GoalPlanValidator 와 같은 값.
 * 루틴 중심 · 최소 실천: 일회성 Task 는 0개가 기본, 루틴은 운동·공부 세션까지 담을 수 있게 90분까지.
 */
export const LIMITS = {
  title: 40,
  subGoals: [1, 3],
  milestones: [1, 4],
  routines: [1, 5],
  oneTimes: [0, 5],
  routineMinutes: [1, 90],
  oneTimeMinutes: [5, 180],
  routineDescription: 300,
  weeklyRoutineMinutes: 420,
} as const

export function validatePlan(plan: GoalPlan): PlanIssue[] {
  const issues: PlanIssue[] = []
  const add = (path: string, message: string) => issues.push({ ruleId: 'CLIENT', path, message })
  const titleOk = (t: string) => t.trim().length >= 1 && t.trim().length <= LIMITS.title

  if (!titleOk(plan.goal.title)) add('goal.title', `목표 이름은 1~${LIMITS.title}자로 적어 주세요.`)

  const [sgMin, sgMax] = LIMITS.subGoals
  if (plan.subGoals.length < sgMin || plan.subGoals.length > sgMax)
    add('subGoals', `세부 목표는 ${sgMin}~${sgMax}개여야 해요.`)
  plan.subGoals.forEach((sg, i) => {
    if (!titleOk(sg.title)) add(`subGoals[${i}].title`, `제목은 1~${LIMITS.title}자로 적어 주세요.`)
  })

  const [msMin, msMax] = LIMITS.milestones
  if (plan.milestones.length < msMin || plan.milestones.length > msMax)
    add('milestones', `마일스톤은 ${msMin}~${msMax}개여야 해요.`)
  plan.milestones.forEach((ms, i) => {
    if (!titleOk(ms.title)) add(`milestones[${i}].title`, `제목은 1~${LIMITS.title}자로 적어 주세요.`)
    const prev = plan.milestones[i - 1]
    if (prev && ms.dueDate <= prev.dueDate) add(`milestones[${i}].dueDate`, '마일스톤 날짜는 앞 단계보다 뒤여야 해요.')
  })
  const lastMs = plan.milestones[plan.milestones.length - 1]
  if (lastMs && lastMs.dueDate !== plan.goal.endDate)
    add(
      `milestones[${plan.milestones.length - 1}].dueDate`,
      `마지막 마일스톤은 목표 종료일(${formatYmdDot(plan.goal.endDate)})이어야 해요.`
    )

  const routines = plan.tasks.filter(isRoutine)
  const oneTimes = plan.tasks.filter((t) => !isRoutine(t))
  const [rMin, rMax] = LIMITS.routines
  const [oMin, oMax] = LIMITS.oneTimes
  if (routines.length < rMin || routines.length > rMax) add('tasks', `루틴은 ${rMin}~${rMax}개여야 해요.`)
  if (oneTimes.length < oMin || oneTimes.length > oMax) add('tasks', `할 일(Task)은 ${oMin}~${oMax}개여야 해요.`)

  plan.tasks.forEach((t, i) => {
    const p = `tasks[${i}]`
    if (!titleOk(t.title)) add(`${p}.title`, `제목은 1~${LIMITS.title}자로 적어 주세요.`)
    if (isRoutine(t)) {
      const [min, max] = LIMITS.routineMinutes
      if (t.durationMinutes < min || t.durationMinutes > max)
        add(`${p}.durationMinutes`, `루틴은 ${min}~${max}분으로 설정해 주세요.`)
      if (!t.routineDays?.length) add(`${p}.routineDays`, '요일을 하나 이상 골라 주세요.')
    } else {
      const [min, max] = LIMITS.oneTimeMinutes
      if (t.durationMinutes < min || t.durationMinutes > max)
        add(`${p}.durationMinutes`, `할 일은 ${min}~${max}분으로 설정해 주세요.`)
      if (!t.dueDate) add(`${p}.dueDate`, '마감일을 정해 주세요.')
      if (t.scheduledDate && t.dueDate && t.scheduledDate > t.dueDate)
        add(`${p}.scheduledDate`, '실행일은 마감일보다 늦을 수 없어요.')
      const ms = plan.milestones.find((m) => m.tempId === t.milestoneTempId)
      if (ms && t.dueDate && t.dueDate > ms.dueDate)
        add(`${p}.dueDate`, `마감일은 연결된 마일스톤(${formatMd(ms.dueDate, false)})보다 늦을 수 없어요.`)
    }
  })

  if (weeklyRoutineMinutes(plan.tasks) > LIMITS.weeklyRoutineMinutes)
    add('tasks', `루틴 시간이 일주일에 ${LIMITS.weeklyRoutineMinutes}분을 넘지 않게 해 주세요.`)

  return issues
}

/**
 * violation path → 화면 항목 키
 *  "tasks[1].durationMinutes" → "tasks[1]"
 *  "goal.title"               → "goal"
 *  "milestones"               → "milestones" (섹션 전체)
 */
export function itemKeyOf(path: string): string {
  const m = path.match(/^([a-zA-Z]+)(\[\d+\])?/)
  return m ? m[0] : path
}

/** 항목 키별 메시지 묶기 */
export function groupIssues(issues: PlanIssue[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const issue of issues) {
    const key = itemKeyOf(issue.path)
    const list = map.get(key) ?? []
    if (!list.includes(issue.message)) list.push(issue.message)
    map.set(key, list)
  }
  return map
}
