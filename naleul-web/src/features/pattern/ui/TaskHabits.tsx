import type { ReactNode } from 'react'
import type { PatternTaskHabits } from '../types'
import { hours1 } from '../format'
import { Section } from './Section'

function Cell({
  label,
  value,
  sub,
  className,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  className?: string
}) {
  return (
    <div className={`border-line p-4 ${className ?? ''}`}>
      <p className="text-ink-3 text-[13px]">{label}</p>
      <p className="mt-1.5 text-[22px] font-extrabold tracking-tight">{value}</p>
      {sub && <p className="text-ink-3 mt-1 text-[12px]">{sub}</p>}
    </div>
  )
}

const DASH = '–'

/** Task 처리 습관 (루틴이 아닌 Task) */
export function TaskHabits({ habits }: { habits?: PatternTaskHabits | null }) {
  const h = habits
  const lead = h?.deadlineLeadDays
  return (
    <Section title="Task 처리 습관" aside={h ? `Task ${h.taskCount}개` : undefined}>
      <div className="grid grid-cols-2">
        <Cell
          className="border-r border-b"
          label="마감 대비 완료"
          value={lead == null ? DASH : lead >= 0 ? `${hours1(lead)}일 먼저` : `${hours1(-lead)}일 늦게`}
          sub={h?.deadlineLabel ?? '마감이 있는 Task를 5개 이상 끝내면 보여요'}
        />
        <Cell
          className="border-b"
          label="미룬 Task"
          value={h?.postponedRate != null ? `${h.postponedRate}%` : DASH}
          sub={
            h?.postponedTopGoal
              ? `대부분 ${h.postponedTopGoal}`
              : h?.postponedRate != null
                ? '미룬 Task가 거의 없어요'
                : undefined
          }
        />
        <Cell
          className="border-r"
          label="brain dump"
          value={h?.brainDumpPerWeek != null ? `주 ${hours1(h.brainDumpPerWeek)}회` : DASH}
          sub={
            h?.brainDumpAvgItems != null
              ? `한 번에 평균 ${hours1(h.brainDumpAvgItems)}개`
              : 'Task 추가를 2번 이상 하면 보여요'
          }
        />
        <Cell
          label="주로 추가하는 때"
          value={h?.brainDumpUsualLabel ?? DASH}
          sub={h?.brainDumpUsualRange ?? undefined}
        />
      </div>
    </Section>
  )
}
