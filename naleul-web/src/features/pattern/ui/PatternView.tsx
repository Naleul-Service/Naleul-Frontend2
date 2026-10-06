'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { usePatternReport } from '../api'
import type { PatternPeriod } from '../types'
import { rangeLabel } from '../format'
import { BlockKeeping } from './BlockKeeping'
import { Heatmap } from './Heatmap'
import { RoutineLists } from './RoutineLists'
import { ShareButton } from './ShareButton'
import { StyleCard } from './StyleCard'
import { SuggestionBar } from './SuggestionBar'
import { SummaryTiles } from './SummaryTiles'
import { TaskHabits } from './TaskHabits'
import { TimeUsage } from './TimeUsage'
import { WeekdayBars } from './WeekdayBars'
import { WeeklyTrend } from './WeeklyTrend'

const PERIODS: { value: PatternPeriod; label: string }[] = [
  { value: 'RECENT_4W', label: '최근 4주' },
  { value: 'ALL', label: '전체' },
]

/** /patterns?period=RECENT_4W|ALL */
export function PatternView() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const period: PatternPeriod = params.get('period') === 'ALL' ? 'ALL' : 'RECENT_4W'
  const { data, isPending, isError, error, refetch, isFetching } = usePatternReport(period)
  const reportRef = useRef<HTMLDivElement>(null)

  const setPeriod = (p: PatternPeriod) => {
    const next = new URLSearchParams(params)
    if (p === 'RECENT_4W') next.delete('period')
    else next.set('period', p)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const header = (
    <PageHeader
      title="나의 패턴"
      description={data ? rangeLabel(data) : ' '}
      actions={
        <>
          <div
            className="bg-surface border-line flex rounded-xl border p-1"
            role="tablist"
            aria-label="기간"
            data-share-exclude
          >
            {PERIODS.map((p) => (
              <button
                key={p.value}
                role="tab"
                aria-selected={period === p.value}
                onClick={() => setPeriod(p.value)}
                className={cn(
                  'h-8 rounded-lg px-3.5 text-[14px] font-semibold transition-colors',
                  period === p.value ? 'bg-ink text-white' : 'text-ink-2 hover:text-ink'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {data && data.evaluatedCount > 0 && <ShareButton targetRef={reportRef} fileDate={data.range.end} />}
        </>
      }
    />
  )

  if (isPending) {
    return (
      <>
        {header}
        <div className="grid min-h-[420px] place-items-center">
          <Spinner className="text-ink-3 size-6" />
        </div>
      </>
    )
  }

  if (isError || !data) {
    return (
      <>
        {header}
        <Card className="mt-6 grid min-h-[280px] place-items-center p-10 text-center">
          <div>
            <p className="text-[17px] font-bold">패턴을 불러오지 못했어요</p>
            <p className="text-ink-3 mt-1.5 text-sm">{error?.message}</p>
            <button className={cn(buttonClass('secondary'), 'mt-4')} onClick={() => refetch()}>
              다시 시도
            </button>
          </div>
        </Card>
      </>
    )
  }

  if (data.evaluatedCount === 0) {
    // 기록이 하나도 없어도 빈 화면 대신 "얼마나 하면 열리는지"를 보여줘요
    return (
      <>
        {header}
        <div className="mt-6">
          <StyleCard style={data.style} />
        </div>
        <Card className="mt-4 flex flex-wrap items-center gap-3 p-5">
          <p className="text-ink-2 min-w-0 flex-1 text-sm">
            Task를 완료하면 바로 패턴이 쌓이기 시작해요. 시간대별 실행률·요일별 패턴은 기록이 조금 더 모이면 열려요.
          </p>
          <Link href="/calendar" className={buttonClass('primary', 'sm')}>
            캘린더로 가기
          </Link>
        </Card>
      </>
    )
  }

  return (
    <div className={cn('transition-opacity', isFetching && 'opacity-70')}>
      {/* 리포트 공유 이미지에 들어가는 영역 (제안 바·안내 문구는 밖에 둠) */}
      <div ref={reportRef}>
        {header}

        <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="xl:col-span-7">
            <StyleCard style={data.style} />
          </div>
          <div className="xl:col-span-5">
            <SummaryTiles summary={data.summary} />
          </div>

          <div className="xl:col-span-8">
            <Heatmap heatmap={data.heatmap} />
          </div>
          <div className="xl:col-span-4">
            <WeekdayBars weekday={data.weekday} />
          </div>

          <div className="max-lg:flex max-lg:flex-col max-lg:gap-4 lg:grid lg:grid-cols-2 lg:gap-4 xl:col-span-12">
            <WeeklyTrend weekly={data.weekly} />
            <TimeUsage usage={data.timeUsage} />
          </div>

          <div className="xl:col-span-4">
            <BlockKeeping block={data.blockKeeping} />
          </div>
          <div className="xl:col-span-4">
            <RoutineLists routines={data.routines} />
          </div>
          <div className="xl:col-span-4">
            <TaskHabits habits={data.taskHabits} />
          </div>
        </div>
      </div>

      <div className="mt-4">
        <SuggestionBar suggestion={data.suggestion} />
      </div>

      {data.aiStatus === 'AI' && (
        <p className="text-ink-4 mt-4 text-right text-[12px]">문장은 AI가 다듬었고, 숫자는 실제 기록으로 계산했어요.</p>
      )}
    </div>
  )
}
