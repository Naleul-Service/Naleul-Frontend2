'use client'

import { useContext, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { todayKst } from '@/features/timetable/time'
import type { GoalCategory } from '../api'
import { EditingContext } from '../edit/inline'
import { formatDot } from '../format'
import { MilestonesSection } from './MilestonesSection'
import { SubGoalsSection, areasOf } from './SubGoalsSection'

/**
 * 세부 구조 (영역 · 점검 시점) — 기본은 접어 둬요.
 *
 * 왜: 예전 상세 화면은 세부 목표·루틴·Task·마일스톤을 같은 무게로 펼쳐 놓아서, 하나를 고치려면 트리 구조와
 * 마일스톤 수치 계산 방식을 먼저 이해해야 했어요. 이제 매일 보는 건 "할 것(루틴·Task)"이고,
 * 영역은 라벨, 점검 시점은 자동으로 맞춰지니 꼭 바꿀 때만 열면 돼요.
 * 접혀 있어도 다음 점검 시점은 요약해서 보여줘요.
 */
export function StructurePanel({ goal }: { goal: GoalCategory }) {
  const [open, setOpen] = useState(false)
  const { editing } = useContext(EditingContext)
  // 이 안의 항목을 편집 중이면 접히지 않게
  const editingInside = !!editing && /^(del:)?(milestone|sub):/.test(editing)
  const expanded = open || editingInside

  const today = todayKst()
  const milestones = [...(goal.milestones ?? [])].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const next = milestones.find((m) => m.status !== 'ACHIEVED' && m.dueDate >= today)
  const achieved = milestones.filter((m) => m.status === 'ACHIEVED').length
  const areas = areasOf(goal)
  const unit = goal.metricUnit ?? ''

  return (
    <section className="border-line bg-surface rounded-[20px] border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 px-5 py-4 text-left sm:px-6"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">세부 구조</span>
          <span className="text-ink-3 mt-0.5 block text-[13px]">
            영역 {areas.length}개 · 점검 시점 {milestones.length ? `${achieved}/${milestones.length} 달성` : '없음'}
          </span>
          {next && (
            <span className="bg-canvas text-ink-2 mt-2 inline-flex flex-wrap items-center gap-1 rounded-lg px-2.5 py-1 text-[13px]">
              다음 점검 <b>{next.title}</b> · {formatDot(next.dueDate).slice(5)}
              {next.targetValue != null && ` · ${next.targetValue}${unit}`}
            </span>
          )}
        </span>
        <ChevronDown className={cn('text-ink-3 mt-1 size-5 shrink-0 transition-transform', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        <div className="border-line space-y-4 border-t p-3 sm:p-4">
          <MilestonesSection goal={goal} />
          <SubGoalsSection goal={goal} />
        </div>
      )}
    </section>
  )
}
