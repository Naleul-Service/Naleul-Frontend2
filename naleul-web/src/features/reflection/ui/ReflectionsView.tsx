'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Library, NotebookPen, PencilLine } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { useGoalCategories, type GoalCategory } from '@/features/goal/api'
import { MOODS, moodOf } from '@/features/goal/ui/progress/DailyCheckInCard'
import { useReflectionRange, type ReflectionEntry, type ReflectionPeriod } from '@/features/home/api'
import { hexOf } from '@/features/timetable/layout'
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

function relLabel(date: string, today: string) {
  const diff = Math.round((Date.parse(today) - Date.parse(date)) / 86_400_000)
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
  const select = (id?: number) => {
    const q = new URLSearchParams(params)
    if (id) q.set('goal', String(id))
    else q.delete('goal')
    router.replace(`${pathname}${q.size ? `?${q}` : ''}`, { scroll: false })
  }

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
              style={{ backgroundColor: hexOf(g.colorCode) }}
              aria-hidden
            />
            <span className="truncate">
              {g.emoji ? `${g.emoji} ` : ''}
              {g.goalCategoryName}
            </span>
          </FilterChip>
        ))}
      </div>

      <ReflectionTimeline goalId={goalId} showGoal={!goalId} />
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
 */
export function ReflectionTimeline({
  goalId,
  showGoal = true,
  emptyHint,
}: {
  goalId?: number
  showGoal?: boolean
  emptyHint?: string
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

  return (
    <div className="flex flex-col gap-4">
      {/* 기간 고르기 + 이동 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="bg-surface border-line inline-flex rounded-xl border p-1" role="tablist" aria-label="기간">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              role="tab"
              aria-selected={period === p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                'h-8 rounded-lg px-3.5 text-[13px] font-semibold transition-colors',
                period === p.value ? 'bg-ink text-on-ink' : 'text-ink-2 hover:text-ink'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAnchor(shift(period, anchor, -1))}
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
            onClick={() => setAnchor(shift(period, anchor, 1))}
            disabled={atLatest}
            aria-label="다음 기간"
            className="text-ink-2 hover:bg-subtle grid size-8 place-items-center rounded-lg disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
          {!atLatest && (
            <button
              type="button"
              onClick={() => setAnchor(today)}
              className="text-brand hover:bg-brand-soft h-8 rounded-lg px-2 text-[12px] font-semibold"
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
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => feed.refetch()}>
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
            <ol className="flex flex-col gap-4">
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
        active ? 'border-ink bg-ink text-on-ink' : 'border-line-strong bg-surface text-ink-2 hover:border-ink-4'
      )}
    >
      {children}
    </button>
  )
}

function EntryRow({ entry: e, showGoal }: { entry: ReflectionEntry; showGoal: boolean }) {
  const mood = moodOf(e.mood)
  const isRetro = e.kind === 'RETRO'
  return (
    <div className="flex gap-3 px-4 py-3">
      <span
        className={cn(
          'mt-0.5 grid size-7 shrink-0 place-items-center rounded-full',
          isRetro ? 'bg-subtle text-ink-2' : 'bg-brand-soft text-brand'
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
              className="flex min-w-0 items-center gap-1.5 text-[13px] font-bold hover:underline"
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: hexOf(e.colorCode) }}
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
