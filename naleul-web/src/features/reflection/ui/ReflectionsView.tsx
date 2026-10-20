'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Library, PencilLine } from 'lucide-react'
import { ChevronLeft, ChevronRight, NotebookPen } from '@/components/icons'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { segmentClass, segmentedClass } from '@/components/ui/SegmentedTabs'
import { track } from '@/lib/client/analytics'
import { referrerType } from '@/lib/client/commonEvents'
import { errorStatusOf } from '@/features/home/analytics'
import { useGoalCategories, type GoalCategory } from '@/features/goal/api'
import { MOODS, moodOf } from '@/features/goal/ui/progress/DailyCheckInCard'
import { useReflectionRange, type ReflectionEntry, type ReflectionPeriod } from '@/features/home/api'
import { goalAccent } from '@/lib/goalTone'
import {
  addDays,
  addMonths,
  dayOfMonth,
  formatMonthDay,
  monthOf,
  startOfWeek,
  todayKst,
  yearOf,
} from '@/features/timetable/time'

const fmt = (v: number) => String(Number(v.toFixed(2)))

/** 회고를 남길 수 있는 목표 (기본 생활 습관 · 임시 목표 · 지운 목표 빼고) */
const filterable = (g: GoalCategory) => g.goalMode !== 'HABIT' && !g.temporary && g.goalCategoryStatus !== 'DELETED'

/** 날짜별로 묶기 (이미 최근 날짜 순으로 와요) */
function byDate(entries: ReflectionEntry[]) {
  const out: { date: string; items: ReflectionEntry[] }[] = []
  for (const e of entries) {
    const last = out[out.length - 1]
    if (last && last.date === e.date) last.items.push(e)
    else out.push({ date: e.date, items: [e] })
  }
  return out
}

/** 오늘부터 며칠 전 날짜인지 (오늘 0) */
const daysAgo = (date: string, today: string) => Math.round((Date.parse(today) - Date.parse(date)) / 86_400_000)

function relLabel(date: string, today: string) {
  const diff = daysAgo(date, today)
  if (diff === 0) return '오늘'
  if (diff === 1) return '어제'
  return `${diff}일 전`
}

/**
 * 회고 모아보기 — 목표 상세 · 홈 · 업무형 보드에서 남긴 회고를 날짜별로 한곳에서 봐요.
 *  - 목표형: 그날 수치 + 기분 + 한 줄 회고 (오늘 기록)
 *  - 업무형: 회고 글
 * 위의 목표 칩으로 한 목표만 볼 수 있어요 (?goal=id).
 */
export function ReflectionsView() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const goalParam = Number(params.get('goal'))
  const goalId = Number.isFinite(goalParam) && goalParam > 0 ? goalParam : undefined

  const goals = useGoalCategories()
  const options = (goals.data ?? []).filter(filterable)
  const optionCount = options.length
  const select = (id?: number) => {
    const index = id ? options.findIndex((g) => g.goalCategoryId === id) : -1
    track('reflections.goal_filter_select', {
      goal_category_id: id,
      goal_mode: index >= 0 ? (options[index].goalMode ?? 'ACHIEVEMENT') : undefined,
      list_position: index + 1, // 칩 줄 순서 ('전체' 0, 목표 칩 1부터)
      filter_option_count: optionCount,
    })
    const q = new URLSearchParams(params)
    if (id) q.set('goal', String(id))
    else q.delete('goal')
    router.replace(`${pathname}${q.size ? `?${q}` : ''}`, { scroll: false })
  }

  // 들어온 길 — 링크에 붙인 ?from= (없으면 주소 직접 · 새로고침). 주소에서 지우지 않아요 (로그인 ?from= 과 같은 관례)
  const fromParam = params.get('from')
  const entrySource =
    fromParam === 'sidebar' || fromParam === 'home_retro' || fromParam === 'goal_detail' ? fromParam : 'url'
  const goalsPending = goals.isPending
  const goalsOk = goals.isSuccess
  const pageviewSent = useRef(false)
  useEffect(() => {
    if (pageviewSent.current || goalsPending) return
    pageviewSent.current = true
    track('reflections.pageview', {
      entry_source: entrySource,
      referrer_type: referrerType(),
      goal_category_id: goalId,
      filter_option_count: goalsOk ? optionCount : undefined,
    })
  }, [goalsPending, goalsOk, entrySource, goalId, optionCount])

  // 목표 칩을 못 불러와 '전체'만 남음 (실패할 때마다 한 번)
  const goalsFailed = goals.isError && !goals.data
  const goalsErrorAt = goals.errorUpdatedAt
  const goalsError = goals.error
  const goalsFailSent = useRef(0)
  useEffect(() => {
    if (!goalsFailed || goalsFailSent.current === goalsErrorAt) return
    goalsFailSent.current = goalsErrorAt
    track('reflections.goals_load_fail', { error_status: errorStatusOf(goalsError) })
  }, [goalsFailed, goalsErrorAt, goalsError])

  // ?goal= 이 칩에 없음 (생활 습관 · 임시 · 지운 목표 · 내 목표 아님) — 목표마다 한 번
  const unmatched = goalsOk && goalId !== undefined && !options.some((g) => g.goalCategoryId === goalId)
  const unmatchedSent = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!unmatched || unmatchedSent.current === goalId) return
    unmatchedSent.current = goalId
    track('reflections.goal_param_unmatched', { goal_category_id: goalId })
  }, [unmatched, goalId])

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-5">
      <PageHeader
        title="회고 모아보기"
        description="목표마다 남긴 기록과 회고를 날짜별로 한 번에 봐요. 홈 · 목표 상세 어디서 쓴 것이든 여기 모여요."
      />

      {/* 목표 고르기 */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="목표 고르기">
        <FilterChip active={!goalId} onClick={() => select()}>
          전체
        </FilterChip>
        {options.map((g) => (
          <FilterChip
            key={g.goalCategoryId}
            active={goalId === g.goalCategoryId}
            onClick={() => select(g.goalCategoryId)}
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: goalAccent(g.colorCode) }}
              aria-hidden
            />
            <span className="truncate">
              {g.emoji ? `${g.emoji} ` : ''}
              {g.goalCategoryName}
            </span>
          </FilterChip>
        ))}
      </div>

      <ReflectionTimeline goalId={goalId} showGoal={!goalId} surface="reflections" />
    </div>
  )
}

const PERIODS: { value: ReflectionPeriod; label: string }[] = [
  { value: 'DAY', label: '일간' },
  { value: 'WEEK', label: '주간' },
  { value: 'MONTH', label: '월간' },
]

const pad2 = (n: number) => String(n).padStart(2, '0')

/** 기준 날짜가 든 기간 [from, to] */
export function periodRange(period: ReflectionPeriod, anchor: string) {
  if (period === 'DAY') return { from: anchor, to: anchor }
  if (period === 'WEEK') {
    const from = startOfWeek(anchor)
    return { from, to: addDays(from, 6) }
  }
  const y = yearOf(anchor)
  const m = monthOf(anchor)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${y}-${pad2(m)}-01`, to: `${y}-${pad2(m)}-${pad2(last)}` }
}

/** 지금 기간에서 몇 칸 떨어진 기간인지 (0 = 오늘 · 이번 주 · 이번 달, -1 = 바로 이전) */
function periodOffset(period: ReflectionPeriod, from: string, today: string) {
  const cur = periodRange(period, today).from
  if (period === 'MONTH') return (yearOf(from) - yearOf(cur)) * 12 + monthOf(from) - monthOf(cur)
  const days = Math.round((Date.parse(from) - Date.parse(cur)) / 86_400_000)
  return period === 'WEEK' ? Math.round(days / 7) : days
}

/** 같은 타임라인이 쓰인 화면 (Amplitude surface) */
export type ReflectionTimelineSurface = 'reflections' | 'goal_detail'

/** 기간 이동 (‹ ›) */
const shift = (period: ReflectionPeriod, anchor: string, n: number) =>
  period === 'DAY' ? addDays(anchor, n) : period === 'WEEK' ? addDays(anchor, n * 7) : addMonths(anchor, n)

function periodTitle(period: ReflectionPeriod, from: string, to: string, today: string) {
  if (period === 'DAY') return from === today ? `오늘 · ${formatMonthDay(from)}` : formatMonthDay(from)
  if (period === 'MONTH') return `${yearOf(from)}년 ${monthOf(from)}월`
  const thisWeek = startOfWeek(today) === from
  return `${thisWeek ? '이번 주 · ' : ''}${monthOf(from)}월 ${dayOfMonth(from)}일 – ${
    monthOf(to) !== monthOf(from) ? `${monthOf(to)}월 ` : ''
  }${dayOfMonth(to)}일`
}

/**
 * 기간별 회고 목록 — 일간 · 주간 · 월간 탭 + ‹ › 로 기간 이동. 회고 모아보기와 목표 상세 "회고" 탭이 같이 써요.
 *  - 일간: 그날 남긴 기록 · 회고
 *  - 주간(기본): 월~일, 날짜별로 묶어서 + 기분 요약
 *  - 월간: 그 달 전체, 날짜별로 묶어서 + 기분 요약 · 가장 많이 기록한 목표
 * @param goalId    한 목표만 (없으면 전체)
 * @param showGoal  줄마다 목표 이름을 보일지 (한 목표만 볼 땐 끄기)
 * @param emptyHint 비었을 때 안내 문구
 * @param surface   Amplitude surface — 회고 모아보기(reflections) / 목표 상세 회고 탭(goal_detail)
 */
export function ReflectionTimeline({
  goalId,
  showGoal = true,
  emptyHint,
  surface,
}: {
  goalId?: number
  showGoal?: boolean
  emptyHint?: string
  surface: ReflectionTimelineSurface
}) {
  const today = todayKst()
  const [period, setPeriod] = useState<ReflectionPeriod>('WEEK')
  const [anchor, setAnchor] = useState(today)
  const { from, to } = periodRange(period, anchor)
  const feed = useReflectionRange(from, to, goalId)
  const entries = feed.data?.entries ?? []
  const groups = byDate(entries)
  const atLatest = to >= today

  const checkIns = entries.filter((e) => e.kind === 'CHECK_IN')
  const moodCounts = MOODS.map((m) => ({ ...m, count: checkIns.filter((e) => e.mood === m.value).length }))
  const days = groups.length
  const totalDays = Math.min(
    Math.round((Date.parse(atLatest ? today : to) - Date.parse(from)) / 86_400_000) + 1,
    Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1
  )

  // ── Amplitude ──
  const offset = periodOffset(period, from, today)
  const viewKey = `${period}:${from}:${goalId ?? ''}`
  const entryCount = entries.length
  const checkInCount = checkIns.length
  const retroCount = entries.filter((e) => e.kind === 'RETRO').length
  const truncated = feed.data?.hasMore ?? false
  // 지금 기간의 데이터를 그렸는지 (이전 기간 자리 표시 데이터는 빼요)
  const shown = feed.isSuccess && !feed.isPlaceholderData

  // 보기 · 빈 화면 — 처음 · 기간 탭 · ‹ › 이동 · 목표 칩마다 한 번
  const lastViewKey = useRef('')
  useEffect(() => {
    if (!shown || lastViewKey.current === viewKey) return
    lastViewKey.current = viewKey
    track('reflection_timeline.view', {
      surface,
      goal_category_id: goalId,
      period,
      period_offset: offset,
      entry_count: entryCount,
      check_in_count: checkInCount,
      retro_count: retroCount,
      day_count: days,
      elapsed_day_count: totalDays,
      is_truncated: truncated,
    })
    if (entryCount === 0) {
      track('reflection_timeline.empty_view', { surface, goal_category_id: goalId, period, period_offset: offset })
    }
  }, [
    shown,
    viewKey,
    surface,
    goalId,
    period,
    offset,
    entryCount,
    checkInCount,
    retroCount,
    days,
    totalDays,
    truncated,
  ])

  // 불러오기 실패 카드 (실패할 때마다 한 번)
  const failed = feed.isError
  const failedAt = feed.errorUpdatedAt
  const feedError = feed.error
  const lastFailAt = useRef(0)
  useEffect(() => {
    if (!failed || lastFailAt.current === failedAt) return
    lastFailAt.current = failedAt
    track('reflection_timeline.load_fail', {
      surface,
      period,
      period_offset: offset,
      error_status: errorStatusOf(feedError),
    })
  }, [failed, failedAt, feedError, surface, period, offset])

  // 목록 스크롤 깊이 25 · 50 · 75 · 100% (목록 끝이 화면 아래에 얼마나 들어왔는지, 기간마다 구간별 한 번)
  const listRef = useRef<HTMLOListElement>(null)
  const scrollSent = useRef(new Set<string>())
  useEffect(() => {
    if (!shown || entryCount === 0) return
    const onScroll = () => {
      const el = listRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      if (rect.height <= 0) return
      const pct = ((window.innerHeight - rect.top) / rect.height) * 100
      for (const mark of [25, 50, 75, 100]) {
        const key = `${viewKey}:${mark}`
        if (pct >= mark - 1 && !scrollSent.current.has(key)) {
          scrollSent.current.add(key)
          track('reflection_timeline.scroll_depth', { surface, period, scroll_percent: mark, entry_count: entryCount })
        }
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [shown, viewKey, surface, period, entryCount])

  const changePeriod = (p: ReflectionPeriod) => {
    if (p === period) return
    track('reflection_timeline.period_change', {
      surface,
      period: p,
      from_period: period,
      period_offset: periodOffset(p, periodRange(p, anchor).from, today),
    })
    setPeriod(p)
  }
  /** ‹ › · 오늘/이번 주/이번 달 — period_offset 은 이동한 뒤 기간 */
  const move = (action: 'prev' | 'next' | 'today', next: string) => {
    track('reflection_timeline.nav_click', {
      surface,
      period,
      date_action: action,
      period_offset: periodOffset(period, periodRange(period, next).from, today),
    })
    setAnchor(next)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 기간 고르기 + 이동 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className={segmentedClass()} role="tablist" aria-label="기간">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              role="tab"
              aria-selected={period === p.value}
              onClick={() => changePeriod(p.value)}
              className={segmentClass(period === p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => move('prev', shift(period, anchor, -1))}
            aria-label="이전 기간"
            className="text-ink-2 hover:bg-subtle grid size-8 place-items-center rounded-lg"
          >
            <ChevronLeft className="size-4" />
          </button>
          <p className="min-w-[140px] text-center text-[14px] font-bold tabular-nums">
            {periodTitle(period, from, to, today)}
          </p>
          <button
            type="button"
            onClick={() => move('next', shift(period, anchor, 1))}
            disabled={atLatest}
            aria-label="다음 기간"
            className="text-ink-2 hover:bg-subtle grid size-8 place-items-center rounded-lg disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
          {!atLatest && (
            <button
              type="button"
              onClick={() => move('today', today)}
              className="text-text-brand hover:bg-brand-soft h-8 rounded-lg px-2 text-[12px] font-semibold"
            >
              {period === 'DAY' ? '오늘' : period === 'WEEK' ? '이번 주' : '이번 달'}
            </button>
          )}
        </div>
      </div>

      {feed.isPending ? (
        <div className="grid min-h-[240px] place-items-center">
          <Spinner className="text-ink-3 size-6" />
        </div>
      ) : feed.isError ? (
        <Card className="p-6 text-center">
          <p className="text-ink-2 text-sm">회고를 불러오지 못했어요.</p>
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            onClick={() => {
              track('reflection_timeline.retry_click', { surface, period, error_status: errorStatusOf(feed.error) })
              feed.refetch()
            }}
          >
            다시 불러오기
          </Button>
        </Card>
      ) : (
        <div className={cn('flex flex-col gap-4 transition-opacity', feed.isPlaceholderData && 'opacity-60')}>
          {/* 이 기간 요약 (주간 · 월간) */}
          {period !== 'DAY' && entries.length > 0 && (
            <Card className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
              <p className="text-[13px]">
                <b className="tabular-nums">{days}일</b>
                <span className="text-ink-3"> 기록 / {totalDays}일</span>
              </p>
              {checkIns.some((e) => e.mood) && (
                <ul className="flex items-center gap-3 text-[13px]" aria-label="기분별 날 수">
                  {moodCounts.map((m) => (
                    <li key={m.value} className="flex items-center gap-1" title={m.label}>
                      <span aria-hidden>{m.emoji}</span>
                      <span className="text-ink-3">{m.label}</span>
                      <b className="tabular-nums">{m.count}</b>
                    </li>
                  ))}
                </ul>
              )}
              {showGoal && <TopGoal entries={entries} />}
            </Card>
          )}

          {groups.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <span className="bg-subtle text-ink-3 grid size-11 place-items-center rounded-full">
                <Library className="size-5" />
              </span>
              <p className="text-[15px] font-bold">
                {period === 'DAY' ? '이날' : period === 'WEEK' ? '이번 주' : '이 달'}에 남긴 회고가 없어요
              </p>
              <p className="text-ink-3 text-[13px]">
                {emptyHint ??
                  '홈의 \u2018오늘 회고\u2019나 목표 상세의 \u2018오늘 기록\u2019에서 하루를 돌아보면 여기 모여요.'}
              </p>
            </Card>
          ) : (
            <ol ref={listRef} className="flex flex-col gap-4">
              {groups.map((g) => (
                <li key={g.date}>
                  {period !== 'DAY' && (
                    <h3 className="mb-2 flex items-baseline gap-2 px-1">
                      <span className="text-[15px] font-bold">{formatMonthDay(g.date)}</span>
                      <span className="text-ink-3 text-[12px]">{relLabel(g.date, today)}</span>
                    </h3>
                  )}
                  <Card className="divide-line divide-y">
                    {g.items.map((e) => (
                      <EntryRow
                        key={`${e.kind}-${e.goalCategoryId}-${e.retrospectiveId ?? e.date}`}
                        entry={e}
                        showGoal={showGoal}
                        surface={surface}
                        today={today}
                      />
                    ))}
                  </Card>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}

/** 이 기간에 기록을 가장 많이 남긴 목표 (전체 보기에서만) */
function TopGoal({ entries }: { entries: ReflectionEntry[] }) {
  const byGoal = new Map<number, { name: string; emoji: string | null; days: Set<string> }>()
  for (const e of entries) {
    const g = byGoal.get(e.goalCategoryId) ?? { name: e.goalName, emoji: e.goalEmoji, days: new Set<string>() }
    g.days.add(e.date)
    byGoal.set(e.goalCategoryId, g)
  }
  const top = [...byGoal.values()].sort((a, b) => b.days.size - a.days.size)[0]
  if (!top || byGoal.size < 2) return null
  return (
    <p className="text-[13px]">
      <span className="text-ink-3">가장 많이 돌아본 목표 </span>
      <b>
        {top.emoji ? `${top.emoji} ` : ''}
        {top.name}
      </b>
      <span className="text-ink-3"> · {top.days.size}일</span>
    </p>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex h-8 max-w-[220px] items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition-colors',
        active ? 'border-text-brand bg-ai-tint-soft text-text-brand' : 'border-border-subtle bg-bg-surface text-text-primary hover:bg-bg-sunken'
      )}
    >
      {children}
    </button>
  )
}

function EntryRow({
  entry: e,
  showGoal,
  surface,
  today,
}: {
  entry: ReflectionEntry
  showGoal: boolean
  surface: ReflectionTimelineSurface
  today: string
}) {
  const mood = moodOf(e.mood)
  const isRetro = e.kind === 'RETRO'
  const ago = daysAgo(e.date, today)
  // 줄 본문을 눌렀지만 반응 없음 (목표 이름 링크 · 글자 고르기는 빼요)
  const onDeadClick = (ev: React.MouseEvent<HTMLDivElement>) => {
    if (ev.target instanceof Element && ev.target.closest('a')) return
    if (window.getSelection()?.toString()) return
    track('reflection_timeline.entry_dead_click', {
      surface,
      entry_kind: e.kind,
      days_ago: ago,
      goal_mode: e.goalMode ?? undefined,
    })
  }
  return (
    <div className="flex gap-3 px-4 py-3" onClick={onDeadClick}>
      <span
        className={cn(
          'mt-0.5 grid size-7 shrink-0 place-items-center rounded-full',
          isRetro ? 'bg-subtle text-ink-2' : 'bg-brand-soft text-text-brand'
        )}
        title={isRetro ? '회고 글' : '오늘 기록'}
      >
        {isRetro ? <PencilLine className="size-3.5" /> : <NotebookPen className="size-3.5" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {showGoal && (
            <Link
              href={`/goal/${e.goalCategoryId}`}
              onClick={() =>
                track('reflection_timeline.goal_link_click', {
                  surface,
                  goal_category_id: e.goalCategoryId,
                  goal_mode: e.goalMode ?? undefined,
                  entry_kind: e.kind,
                  days_ago: ago,
                })
              }
              className="flex min-w-0 items-center gap-1.5 text-[13px] font-bold hover:underline"
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: goalAccent(e.colorCode) }}
                aria-hidden
              />
              <span className="truncate">
                {e.goalEmoji ? `${e.goalEmoji} ` : ''}
                {e.goalName}
              </span>
            </Link>
          )}
          {e.value != null && (
            <span className="bg-subtle rounded-full px-2 py-0.5 text-[12px]">
              <span className="text-ink-3">{e.metricName ?? '수치'} </span>
              <b>
                {fmt(e.value)}
                {e.unit ?? ''}
              </b>
            </span>
          )}
          {mood && (
            <span className="bg-subtle rounded-full px-2 py-0.5 text-[12px] font-semibold">
              {mood.emoji} {mood.label}
            </span>
          )}
          {isRetro && e.reviewType && e.reviewType !== 'DAILY' && (
            <span className="text-ink-3 text-[11px] font-semibold">
              {e.reviewType === 'WEEKLY' ? '주간 회고' : '월간 회고'}
            </span>
          )}
        </div>
        {e.note ? (
          <p className="text-ink-2 mt-1 text-[14px] leading-relaxed whitespace-pre-wrap">{e.note}</p>
        ) : (
          !isRetro && <p className="text-ink-4 mt-1 text-[12px]">수치만 남겼어요</p>
        )}
      </div>
    </div>
  )
}
