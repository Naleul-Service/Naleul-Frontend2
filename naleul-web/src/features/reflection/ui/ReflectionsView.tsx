'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Library, NotebookPen, PencilLine } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { useGoalCategories, type GoalCategory } from '@/features/goal/api'
import { MOODS, moodOf } from '@/features/goal/ui/progress/DailyCheckInCard'
import { useReflectionFeed, type ReflectionEntry } from '@/features/home/api'
import { hexOf } from '@/features/timetable/layout'
import { formatMonthDay, todayKst } from '@/features/timetable/time'

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
  const feed = useReflectionFeed(goalId)
  const entries = feed.data?.pages.flatMap((p) => p.entries) ?? []
  const groups = byDate(entries)
  const today = todayKst()
  const oldest = feed.data?.pages[feed.data.pages.length - 1]?.from

  const options = (goals.data ?? []).filter(filterable)
  const select = (id?: number) => {
    const q = new URLSearchParams(params)
    if (id) q.set('goal', String(id))
    else q.delete('goal')
    router.replace(`${pathname}${q.size ? `?${q}` : ''}`, { scroll: false })
  }

  const checkIns = entries.filter((e) => e.kind === 'CHECK_IN')
  const moodCounts = MOODS.map((m) => ({ ...m, count: checkIns.filter((e) => e.mood === m.value).length }))
  const days = groups.length

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

      {feed.isPending ? (
        <div className="grid min-h-[300px] place-items-center">
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
        <>
          {/* 이 기간 요약 */}
          {entries.length > 0 && (
            <Card className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
              <p className="text-[13px]">
                <span className="text-ink-3">{oldest ? `${formatMonthDay(oldest)}부터 ` : ''}</span>
                <b className="tabular-nums">{days}일</b>
                <span className="text-ink-3"> 기록</span>
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
            </Card>
          )}

          {groups.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <span className="bg-subtle text-ink-3 grid size-11 place-items-center rounded-full">
                <Library className="size-5" />
              </span>
              <p className="text-[15px] font-bold">아직 남긴 회고가 없어요</p>
              <p className="text-ink-3 text-[13px]">
                홈의 &lsquo;오늘 회고&rsquo;나 목표 상세의 &lsquo;오늘 기록&rsquo;에서 하루를 돌아보면 여기 모여요.
              </p>
              <Link href="/" className="text-brand mt-1 text-[13px] font-semibold hover:underline">
                홈으로 가기
              </Link>
            </Card>
          ) : (
            <ol className="flex flex-col gap-4">
              {groups.map((g) => (
                <li key={g.date}>
                  <h2 className="mb-2 flex items-baseline gap-2 px-1">
                    <span className="text-[15px] font-bold">{formatMonthDay(g.date)}</span>
                    <span className="text-ink-3 text-[12px]">{relLabel(g.date, today)}</span>
                  </h2>
                  <Card className="divide-line divide-y">
                    {g.items.map((e) => (
                      <EntryRow
                        key={`${e.kind}-${e.goalCategoryId}-${e.retrospectiveId ?? e.date}`}
                        entry={e}
                        showGoal={!goalId}
                      />
                    ))}
                  </Card>
                </li>
              ))}
            </ol>
          )}

          {feed.hasNextPage && (
            <Button
              variant="secondary"
              className="self-center"
              loading={feed.isFetchingNextPage}
              onClick={() => feed.fetchNextPage()}
            >
              이전 30일 더 보기
            </Button>
          )}
        </>
      )}
    </div>
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
