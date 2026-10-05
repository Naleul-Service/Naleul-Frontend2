/**
 * TimeTable 격자에 블록을 놓기 위한 순수 계산 (화면과 분리해서 테스트하기 쉽게).
 */
import { minutesFrom, toDateTime } from './time'
import type { FixedBlock, TimeBlockTask, TimetableDay } from './types'

export const DEFAULT_START_HOUR = 7
export const DEFAULT_END_HOUR = 24
const MIN_TASK_MINUTES = 15 // 너무 짧은 블록도 글자가 보이도록

/**
 * 격자에 보여줄 시간 범위 (시 단위).
 * 기본은 하루 범위(기상 ~ 취침)이고, 그 밖에 Task 가 있으면 넓혀요.
 * 수면 패턴이 없으면 백엔드가 00:00~24:00 을 주므로 그대로 0~24시.
 */
export function visibleHours(days: TimetableDay[]) {
  if (!days.length) return { startHour: DEFAULT_START_HOUR, endHour: DEFAULT_END_HOUR }
  let start = Infinity
  let end = -Infinity
  for (const d of days) {
    start = Math.min(start, minutesFrom(d.date, d.dayRange.start))
    end = Math.max(end, minutesFrom(d.date, d.dayRange.end))
    for (const t of d.tasks) {
      if (!t.plannedStartAt) continue
      const s = minutesFrom(d.date, t.plannedStartAt)
      start = Math.min(start, s)
      end = Math.max(end, t.plannedEndAt ? minutesFrom(d.date, t.plannedEndAt) : s + 30)
    }
  }
  const startHour = Math.max(0, Math.min(DEFAULT_END_HOUR - 1, Math.floor(start / 60)))
  // 끝은 항상 24시까지 — 취침 직전·늦은 밤으로도 끌어다 놓을 수 있게
  const endHour = Math.min(24, Math.max(startHour + 1, Math.ceil(end / 60), DEFAULT_END_HOUR))
  return { startHour, endHour }
}

export interface Placed<T> {
  item: T
  /** 그날 0시 기준 분 (화면 범위로 잘림) */
  top: number
  bottom: number
  /** 잘리기 전 원래 시각(분) — 글자로 보여줄 때 */
  start: number
  end: number
  /** 원래 시간이 화면 범위 밖까지 이어지는지 */
  clippedTop: boolean
  clippedBottom: boolean
  /** 겹칠 때 나란히 놓기 위한 열 정보 */
  col: number
  cols: number
}

function clip(start: number, end: number, from: number, to: number) {
  const top = Math.max(start, from)
  const bottom = Math.min(end, to)
  if (bottom <= top) return null
  return { top, bottom, start, end, clippedTop: start < from, clippedBottom: end > to }
}

export function placeFixed(day: TimetableDay, from: number, to: number): Placed<FixedBlock>[] {
  const out: Placed<FixedBlock>[] = []
  for (const b of day.fixedBlocks) {
    const c = clip(minutesFrom(day.date, b.start), minutesFrom(day.date, b.end), from, to)
    if (c) out.push({ item: b, ...c, col: 0, cols: 1 })
  }
  return out
}

/**
 * Task 블록 배치. 백엔드 규칙상 Task 끼리는 겹치지 않지만,
 * 예전 데이터(iOS 에서 만든 겹친 일정)가 있을 수 있어 겹치면 나란히 그려요.
 */
export function placeTasks(day: TimetableDay, from: number, to: number): Placed<TimeBlockTask>[] {
  const items = day.tasks
    .filter((t) => t.plannedStartAt)
    .map((t) => {
      const s = minutesFrom(day.date, t.plannedStartAt!)
      const rawEnd = t.plannedEndAt ? minutesFrom(day.date, t.plannedEndAt) : s + (t.plannedDurationMinutes ?? 30)
      const c = clip(s, Math.max(rawEnd, s + MIN_TASK_MINUTES), from, to)
      return { t, c: c && { ...c, end: rawEnd } }
    })
    .filter((x): x is { t: TimeBlockTask; c: NonNullable<ReturnType<typeof clip>> } => !!x.c)
    .sort((a, b) => a.c.top - b.c.top || b.c.bottom - a.c.bottom)

  const out: Placed<TimeBlockTask>[] = []
  // 겹치는 덩어리(cluster)마다 열을 나눠요
  let cluster: Placed<TimeBlockTask>[] = []
  let clusterEnd = -Infinity
  const colEnds: number[] = []
  const flush = () => {
    const cols = Math.max(1, colEnds.length)
    cluster.forEach((p) => (p.cols = cols))
    out.push(...cluster)
    cluster = []
    colEnds.length = 0
  }
  for (const { t, c } of items) {
    if (c.top >= clusterEnd) flush()
    let col = colEnds.findIndex((end) => end <= c.top)
    if (col === -1) {
      col = colEnds.length
      colEnds.push(c.bottom)
    } else colEnds[col] = c.bottom
    cluster.push({ item: t, ...c, col, cols: 1 })
    clusterEnd = Math.max(clusterEnd, c.bottom)
  }
  flush()
  return out
}

/** "#3D5AFE" / "3D5AFE" / null → "#3D5AFE" (없으면 회색) */
export const hexOf = (code?: string | null) => (code ? (code.startsWith('#') ? code : `#${code}`) : '#8B9099')

/** "#3D5AFE" + 0.15 → "rgba(61, 90, 254, 0.15)" */
export function withAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h.slice(0, 6)
  const n = parseInt(full, 16)
  if (Number.isNaN(n)) return `rgba(139, 144, 153, ${alpha})`
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

// ─── 드래그 결과를 서버 응답 전에 먼저 보여주기 (낙관적 표시) ─────────────────

export type Pending =
  /** Task 를 date 의 start~end 로 옮김. date 가 null 이면 "시간 미정"으로 보냄 */
  | { kind: 'task'; taskId: number; date: string | null; start: number; end: number }
  /** 고정 블록(fixedKey)을 그날 start~end 로 바꿈 */
  | { kind: 'fixed'; key: string; date: string; start: number; end: number }

/**
 * 서버 응답이 오기 전까지 옮긴 위치에 블록을 그려요.
 * 응답이 오면(성공·실패 모두) TimeTable 을 다시 불러오고 pending 을 지워요.
 */
export function applyPending(
  days: TimetableDay[],
  pending: Pending[],
  keyOf: (b: FixedBlock) => string
): TimetableDay[] {
  if (!pending.length) return days
  const taskMoves = new Map<number, Extract<Pending, { kind: 'task' }>>()
  const fixedMoves = new Map<string, Extract<Pending, { kind: 'fixed' }>>()
  for (const p of pending) {
    if (p.kind === 'task') taskMoves.set(p.taskId, p)
    else fixedMoves.set(p.key, p)
  }

  const all = days.flatMap((d) => [...d.tasks, ...d.unscheduledTasks])
  return days.map((d) => {
    const keep = (t: TimeBlockTask) => !taskMoves.has(t.taskId)
    const tasks = d.tasks.filter(keep)
    const unscheduledTasks = d.unscheduledTasks.filter(keep)
    for (const [id, p] of taskMoves) {
      const t = all.find((x) => x.taskId === id)
      if (!t) continue
      if (p.date === d.date) {
        tasks.push({
          ...t,
          date: d.date,
          plannedStartAt: toDateTime(d.date, p.start),
          plannedEndAt: toDateTime(d.date, p.end),
          locked: true,
          placedBy: 'USER',
          missed: false,
        })
      } else if (p.date === null && (t.date ?? t.plannedStartAt?.slice(0, 10)) === d.date) {
        unscheduledTasks.push({ ...t, plannedStartAt: null, plannedEndAt: null, locked: false })
      }
    }
    const fixedBlocks = d.fixedBlocks.map((b) => {
      const p = fixedMoves.get(keyOf(b))
      return p && p.date === d.date
        ? { ...b, start: toDateTime(d.date, p.start), end: toDateTime(d.date, p.end), overridden: true }
        : b
    })
    return { ...d, tasks, unscheduledTasks, fixedBlocks }
  })
}

/** 자동 배치가 밀어낼 수 없는 블록 (겹치면 백엔드 409) — 백엔드 isMovableEngineBlock 의 반대 */
export const isBlockingTask = (t: TimeBlockTask) =>
  t.locked || t.placedBy !== 'ENGINE' || t.taskStatus !== 'TODO' || t.sourceType === 'MISSION'

/** start~end 에 겹치는 "밀어낼 수 없는" Task (자기 자신 제외) */
export function blockingOverlap(day: TimetableDay, start: number, end: number, selfId: number) {
  return day.tasks.find((t) => {
    if (t.taskId === selfId || !t.plannedStartAt || !isBlockingTask(t)) return false
    const s = minutesFrom(day.date, t.plannedStartAt)
    const e = t.plannedEndAt ? minutesFrom(day.date, t.plannedEndAt) : s + 30
    return s < end && e > start
  })
}
