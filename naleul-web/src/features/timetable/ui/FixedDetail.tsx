'use client'

import Link from 'next/link'
import { CalendarOff, Clock, RotateCcw, Settings } from 'lucide-react'
import { Button, buttonClass } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Chip'
import { cn } from '@/lib/cn'
import { formatMonthDay, hm } from '../time'
import type { FixedBlock } from '../types'

export interface FixedActions {
  onEditTime: (b: FixedBlock) => void
  onSkip: (b: FixedBlock) => void
  onReset: (b: FixedBlock) => void
}

const TYPE_LABEL = { SLEEP: '수면', LUNCH: '점심', DINNER: '저녁', CUSTOM: '고정 일정' } as const

export function FixedDetail({ block: b, busy, actions }: { block: FixedBlock; busy?: boolean; actions: FixedActions }) {
  const covered = b.coveredBy ?? []
  // 자정을 넘긴 수면의 다음 날 조각: 시작 시각을 몰라 시간 변경은 시작한 날에서 해요
  const canEditTime = !b.clippedFromPreviousDay

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-center gap-1.5 pr-8">
        <Badge>고정 시간 · {TYPE_LABEL[b.patternType]}</Badge>
        {b.overridden && <Badge tone="brand">이날만 바뀐 시간</Badge>}
      </div>

      <h3 className="mt-2.5 text-lg font-bold">
        {b.emoji ? `${b.emoji} ` : ''}
        {b.title}
      </h3>
      <p className="text-ink-2 mt-2 flex items-center gap-2 text-sm">
        <Clock className="text-ink-3 size-4" />
        {formatMonthDay(b.targetDate)} · {hm(b.start)} – {hm(b.end) === '00:00' ? '24:00' : hm(b.end)}
      </p>

      {b.clippedFromPreviousDay && (
        <p className="bg-subtle text-ink-3 mt-3 rounded-xl px-3.5 py-2.5 text-xs leading-relaxed">
          전날 밤에 시작한 {b.title} 시간이에요. 시간을 바꾸려면 {formatMonthDay(b.targetDate)} 블록을 눌러 주세요.
        </p>
      )}
      {covered.length > 0 && (
        <p className="bg-warning-soft mt-3 rounded-xl px-3.5 py-2.5 text-xs leading-relaxed text-[#b45309]">
          직접 정한 Task가 이 시간의 일부를 덮고 있어요.
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2">
        {canEditTime && (
          <Button variant="secondary" onClick={() => actions.onEditTime(b)} disabled={busy}>
            <Clock className="size-4" />
            이날만 시간 변경
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() => actions.onSkip(b)}
          loading={busy}
          className={cn(!canEditTime && 'col-span-2')}
        >
          <CalendarOff className="size-4" />
          이날만 비우기
        </Button>
        {b.overridden && (
          <Button variant="ghost" className="col-span-2" onClick={() => actions.onReset(b)} disabled={busy}>
            <RotateCcw className="size-4" />
            기본 시간으로 되돌리기
          </Button>
        )}
        <Link href="/settings/life-pattern" className={cn(buttonClass('ghost'), 'col-span-2')}>
          <Settings className="size-4" />
          기본 패턴 수정
        </Link>
      </div>
      <p className="text-ink-4 mt-3 text-center text-[11px]">이날만 바꾼 내용은 다음 날부터 기본 패턴으로 돌아와요.</p>
    </div>
  )
}
