'use client'

import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/ui/Spinner'
import { addDays, formatDuration, formatMonthDay, todayKst } from '@/features/timetable/time'
import type { ActualActivity } from '@/features/timetable/types'
import { useDeleteRecord } from '../api'

/** 기록을 날짜별로 (최근 날짜 먼저) */
function groupByDate(list: ActualActivity[]) {
  const map = new Map<string, ActualActivity[]>()
  for (const a of list) {
    const d = a.startAt.slice(0, 10)
    map.set(d, [...(map.get(d) ?? []), a])
  }
  return [...map.entries()].sort(([a], [b]) => b.localeCompare(a))
}

function dayLabel(ymd: string, today: string) {
  if (ymd === today) return `오늘 · ${formatMonthDay(ymd)}`
  if (ymd === addDays(today, -1)) return `어제 · ${formatMonthDay(ymd)}`
  return formatMonthDay(ymd)
}

/**
 * 기록형 목표 상세 — 날짜별 "한 일" 타임라인.
 * 진행 그래프 대신 "그동안 무엇을 했는지"를 보여줘요 (회사 업무 기록의 핵심).
 */
export function RecordTimeline({ activities, loading }: { activities: ActualActivity[]; loading: boolean }) {
  const today = todayKst()
  const groups = useMemo(() => groupByDate(activities), [activities])
  const del = useDeleteRecord()
  const [pending, setPending] = useState<ActualActivity | null>(null)

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[17px] font-bold">한 일</h2>
        <span className="text-ink-3 text-[13px]">최근 {activities.length}개</span>
      </div>

      {loading && (
        <div className="grid h-24 place-items-center">
          <Spinner className="text-ink-3 size-5" />
        </div>
      )}

      {!loading && activities.length === 0 && (
        <p className="bg-canvas text-ink-3 rounded-2xl px-4 py-6 text-center text-sm">
          아직 기록이 없어요. 위에서 오늘 한 일을 한 줄로 적어 보세요.
        </p>
      )}

      <div className="space-y-5">
        {groups.map(([date, items]) => {
          const total = items.reduce((n, a) => n + a.durationMinutes, 0)
          return (
            <section key={date}>
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-[14px] font-bold">{dayLabel(date, today)}</h3>
                <span className="text-ink-3 text-xs tabular-nums">
                  {items.length}개 · {formatDuration(total)}
                </span>
              </div>
              <ul className="border-line divide-line divide-y rounded-2xl border">
                {[...items]
                  .sort((a, b) => a.startAt.localeCompare(b.startAt))
                  .map((a) => (
                    <li key={a.activityId} className="group flex items-center gap-3 px-4 py-3">
                      <span className="text-ink-3 w-[92px] shrink-0 text-[13px] tabular-nums">
                        {a.startAt.slice(11, 16)}–{a.endAt.slice(11, 16)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{a.title}</span>
                      <span className="text-ink-3 shrink-0 text-xs">{formatDuration(a.durationMinutes)}</span>
                      <button
                        type="button"
                        onClick={() => setPending(a)}
                        aria-label={`${a.title} 기록 지우기`}
                        className="text-ink-4 hover:text-danger rounded-lg p-1 opacity-60 group-hover:opacity-100"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          )
        })}
      </div>

      <ConfirmDialog
        open={!!pending}
        tone="danger"
        title="이 기록을 지울까요?"
        description={pending ? `"${pending.title}" 기록이 사라져요.` : undefined}
        confirmLabel="지우기"
        loading={del.isPending}
        onConfirm={() => pending && del.mutate(pending.activityId, { onSettled: () => setPending(null) })}
        onCancel={() => setPending(null)}
      />
    </Card>
  )
}
