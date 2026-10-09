'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Copy, PenLine, Repeat, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/ui/Spinner'
import { toast } from '@/stores/toastStore'
import { addDays, formatDuration, formatMonthDay, startOfWeek, todayKst } from '@/features/timetable/time'
import { useDeleteRecord, useRecordJournal, type JournalDay, type JournalItem } from '../api'
import { journalText } from '../journalText'

function dayLabel(ymd: string, today: string) {
  if (ymd === today) return `오늘 · ${formatMonthDay(ymd)}`
  if (ymd === addDays(today, -1)) return `어제 · ${formatMonthDay(ymd)}`
  return formatMonthDay(ymd)
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('복사했어요. 원하는 곳에 붙여 넣으세요.')
  } catch {
    toast.error('복사하지 못했어요. 다시 시도해 주세요.')
  }
}

/**
 * 업무 일지 — 날짜별로 "그날 완료한 Task"와 "직접 남긴 기록"을 한 목록으로.
 *  - 하루 / 이번 주 단위로 글로 복사 (업무 보고·회고에 바로 붙여 넣기)
 *  - 직접 남긴 기록만 여기서 지울 수 있어요 (Task 완료 취소는 Task 목록에서)
 */
export function RecordJournal({ goalId, goalName }: { goalId: number; goalName: string }) {
  const today = todayKst()
  const { data, isPending, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = useRecordJournal(goalId)
  const days = useMemo(() => data?.pages.flatMap((p) => p.days) ?? [], [data])
  const del = useDeleteRecord()
  const [pending, setPending] = useState<JournalItem | null>(null)

  const copyWeek = () => {
    const weekStart = startOfWeek(today)
    const week = days.filter((d) => d.date >= weekStart)
    if (!week.length) {
      toast.show('이번 주 일지가 아직 없어요.')
      return
    }
    copy(journalText(`${goalName} · 업무 일지 · ${formatMonthDay(weekStart)} – ${formatMonthDay(today)}`, week))
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-bold">업무 일지</h2>
        <Button variant="secondary" size="sm" onClick={copyWeek} disabled={!days.length}>
          <Copy className="size-3.5" />
          이번 주 복사
        </Button>
      </div>
      <p className="text-ink-3 mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="text-brand size-3.5" /> 완료한 Task
        </span>
        <span className="flex items-center gap-1">
          <PenLine className="size-3.5" /> 직접 남긴 기록
        </span>
      </p>

      {isPending ? (
        <div className="grid h-24 place-items-center">
          <Spinner className="text-ink-3 size-5" />
        </div>
      ) : isError ? (
        <div className="bg-canvas flex items-center justify-between gap-3 rounded-2xl px-4 py-4 text-sm">
          <span className="text-ink-2">일지를 불러오지 못했어요.</span>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            다시 시도
          </Button>
        </div>
      ) : days.length === 0 ? (
        <p className="bg-canvas text-ink-3 rounded-2xl px-4 py-6 text-center text-sm leading-relaxed">
          {hasNextPage
            ? '최근 2주에는 일지가 없어요. 아래에서 이전 일지를 볼 수 있어요.'
            : '아직 일지가 없어요. 이 목표의 Task를 완료하거나 위에서 한 일을 남기면 날짜별로 쌓여요.'}
        </p>
      ) : (
        <div className="space-y-5">
          {days.map((d) => (
            <JournalDaySection key={d.date} day={d} today={today} goalName={goalName} onDelete={setPending} />
          ))}
        </div>
      )}

      {hasNextPage && (
        <Button variant="ghost" fullWidth className="mt-4" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
          이전 2주 더 보기
        </Button>
      )}

      <ConfirmDialog
        open={!!pending}
        tone="danger"
        title="이 기록을 지울까요?"
        description={pending ? `"${pending.title}" 기록이 사라져요.` : undefined}
        confirmLabel="지우기"
        loading={del.isPending}
        onConfirm={() => pending && del.mutate(pending.id, { onSettled: () => setPending(null) })}
        onCancel={() => setPending(null)}
      />
    </Card>
  )
}

function JournalDaySection({
  day,
  today,
  goalName,
  onDelete,
}: {
  day: JournalDay
  today: string
  goalName: string
  onDelete: (item: JournalItem) => void
}) {
  const summary = [
    day.taskCount && `Task ${day.taskCount}`,
    day.recordCount && `기록 ${day.recordCount}`,
    day.minutes && formatDuration(day.minutes),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-bold">{dayLabel(day.date, today)}</h3>
        <div className="flex items-center gap-1">
          <span className="text-ink-3 text-xs tabular-nums">{summary}</span>
          <button
            type="button"
            onClick={() => copy(journalText(`${goalName} · 업무 일지`, [day]))}
            aria-label={`${formatMonthDay(day.date)} 일지 복사`}
            title="이 날 일지 복사"
            className="text-ink-4 hover:bg-subtle hover:text-ink rounded-lg p-1.5"
          >
            <Copy className="size-3.5" />
          </button>
        </div>
      </div>
      <ul className="border-line divide-line divide-y rounded-2xl border">
        {day.items.map((i) => (
          <li key={`${i.type}-${i.id}`} className="group flex items-start gap-3 px-4 py-3">
            <span className="text-ink-3 w-[92px] shrink-0 pt-0.5 text-[13px] tabular-nums">
              {i.startAt && i.endAt ? `${i.startAt.slice(11, 16)}–${i.endAt.slice(11, 16)}` : '시간 미정'}
            </span>
            {i.type === 'TASK' ? (
              <CheckCircle2 className="text-brand mt-0.5 size-4 shrink-0" aria-label="완료한 Task" />
            ) : (
              <PenLine className="text-ink-3 mt-0.5 size-4 shrink-0" aria-label="직접 남긴 기록" />
            )}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[15px] font-medium">
                <span className="truncate">
                  {i.emoji && <span className="mr-1">{i.emoji}</span>}
                  {i.title}
                </span>
                {i.routine && (
                  <span className="bg-brand-soft text-brand inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-bold">
                    <Repeat className="size-2.5" />
                    루틴
                  </span>
                )}
              </p>
              {i.memo && <p className="text-ink-3 mt-0.5 text-[13px]">{i.memo}</p>}
            </div>
            {i.minutes ? <span className="text-ink-3 shrink-0 pt-0.5 text-xs">{formatDuration(i.minutes)}</span> : null}
            {i.type === 'RECORD' ? (
              <button
                type="button"
                onClick={() => onDelete(i)}
                aria-label={`${i.title} 기록 지우기`}
                className="text-ink-4 hover:text-danger rounded-lg p-1 opacity-60 group-hover:opacity-100"
              >
                <Trash2 className="size-4" />
              </button>
            ) : (
              <span className="w-6 shrink-0" aria-hidden />
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
