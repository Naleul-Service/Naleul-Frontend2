'use client'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { useRecordPattern } from '../../api'
import { RecordRhythmCard } from './RecordRhythmCard'
import { RecordRoutineCard } from './RecordRoutineCard'
import { RecordSummaryTiles } from './RecordSummaryTiles'
import { RecordWeeklyCard } from './RecordWeeklyCard'
import { RecordWhenCard } from './RecordWhenCard'

/**
 * 기록형 목표 상세 — "이 목표에 대한 나의 패턴".
 *
 * 기록형은 기한도 목표 수치도 없어서 달성률(%)을 낼 수 없어요.
 * 대신 "언제·얼마나" 하는지와 루틴별로 쌓인 시간을 숫자로 보여주고,
 * 성장은 "그 전 4주보다 늘어난 것"과 "줄지 않는 누적"으로 보여줘요.
 * (유형 이름·분석 문장 같은 AI 말투는 쓰지 않아요)
 */
export function RecordPatternSection({ goalId }: { goalId: number }) {
  const { data, isPending, isError, refetch } = useRecordPattern(goalId)

  if (isPending) {
    return (
      <div className="grid h-48 place-items-center">
        <Spinner className="text-ink-3 size-6" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <Card className="flex flex-wrap items-center gap-3 p-5">
        <p className="text-ink-2 min-w-0 flex-1 text-sm">이 목표의 패턴을 불러오지 못했어요.</p>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          다시 시도
        </Button>
      </Card>
    )
  }

  const hasRoutines = data.routines.items.length > 0

  // 한 일 기록이 아직 없으면 빈 그래프 대신 안내 한 줄 (루틴이 있으면 루틴 카드는 보여줘요)
  if (data.summary.totalRecords === 0) {
    return (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className={hasRoutines ? 'p-6 xl:col-span-6' : 'p-6 xl:col-span-12'}>
          <p className="text-[16px] font-bold">아직 쌓인 기록이 없어요</p>
          <p className="text-ink-3 mt-1.5 text-sm leading-relaxed">
            위에서 오늘 한 일을 한 줄 남기면 주차별로 쌓인 시간, 기록의 리듬, 주로 하는 때가 여기에 보여요.
          </p>
        </Card>
        {hasRoutines && (
          <div className="xl:col-span-6">
            <RecordRoutineCard routines={data.routines} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="xl:col-span-12">
        <RecordSummaryTiles summary={data.summary} />
      </div>

      <div className="xl:col-span-7">
        <RecordWeeklyCard weeks={data.rhythm.weeks} />
      </div>
      <div className="xl:col-span-5">
        <RecordRhythmCard rhythm={data.rhythm} />
      </div>

      <div className={hasRoutines ? 'xl:col-span-6' : 'xl:col-span-12'}>
        <RecordWhenCard when={data.when} totalRecords={data.summary.totalRecords} wide={!hasRoutines} />
      </div>
      {hasRoutines && (
        <div className="xl:col-span-6">
          <RecordRoutineCard routines={data.routines} />
        </div>
      )}
    </div>
  )
}
