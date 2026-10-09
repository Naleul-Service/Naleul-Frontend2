'use client'

import { ArrowRight, CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAcceptAllCarry, useAcceptCarry, useDeclineCarry } from '../api'
import { addDays, formatMonthDay, hm } from '../time'
import type { TimeBlockTask } from '../types'

/** 기준 날짜(base)에서 본 상대 날짜: 오늘 · 어제 · 그제 · 내일 · 10월 8일 */
function relDay(date: string, base: string) {
  if (date === base) return '오늘'
  if (date === addDays(base, -1)) return '어제'
  if (date === addDays(base, -2)) return '그제'
  if (date === addDays(base, 1)) return '내일'
  return formatMonthDay(date)
}

/** "을/를" — 받침에 맞게 */
const eulReul = (word: string) => {
  const c = word.charCodeAt(word.length - 1)
  if (c < 0xac00 || c > 0xd7a3) return `${word}을(를)`
  return `${word}${(c - 0xac00) % 28 ? '을' : '를'}`
}

/**
 * 22시 이월 제안 — 못 한 일을 말없이 옮기면 "내가 잘못 넣었나?" 하고 헷갈려서, 옮긴 자리를 점선으로 보여주고 물어봐요.
 *   "어제 못한 '보고서 쓰기'를 오늘 15:00–16:00로 옮길까요?"  [옮기기] [안 옮기기]
 *  - 옮기기: 점선 자리 그대로 확정
 *  - 안 옮기기: 시간을 비워 그날 "시간 미정"으로 (원하는 시간에 끌어다 놓거나 지우면 돼요)
 *  - 여러 개면 하나씩 묻고, "모두 옮기기"로 한 번에
 * 블록을 직접 끌어 옮기거나 완료하면 답한 것으로 봐요.
 */
export function CarryProposalBar({ tasks, today }: { tasks: TimeBlockTask[]; today: string }) {
  const accept = useAcceptCarry()
  const decline = useDeclineCarry()
  const acceptAll = useAcceptAllCarry()
  const busy = accept.isPending || decline.isPending || acceptAll.isPending
  const t = tasks[0]
  if (!t) return null

  const date = t.plannedStartAt?.slice(0, 10) ?? t.date ?? today
  const from = t.carriedFromDate ? relDay(t.carriedFromDate, today) : '전날'
  const to = relDay(date, today)
  const name = `'${t.emoji ? `${t.emoji} ` : ''}${t.taskName}'`
  const when = t.plannedStartAt ? `${to} ${hm(t.plannedStartAt)}–${hm(t.plannedEndAt)}` : `${to}(시간 미정)`
  const sameDay = tasks.filter((x) => (x.plannedStartAt?.slice(0, 10) ?? x.date) === date)

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div
        role="dialog"
        aria-label="못 한 일 옮기기"
        className="bg-surface shadow-pop border-line pointer-events-auto w-full max-w-[600px] animate-[modal-in_160ms_ease-out] rounded-2xl border p-4"
      >
        <div className="flex items-start gap-3">
          <span className="bg-brand-soft text-brand grid size-9 shrink-0 place-items-center rounded-full">
            <CalendarClock className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] leading-snug font-bold">
              {from} 못한 {eulReul(name)} {when}로 옮길까요?
            </p>
            <p className="text-ink-3 mt-0.5 flex flex-wrap items-center gap-1 text-[12px]">
              {t.carriedFromDate && <span>{formatMonthDay(t.carriedFromDate)}</span>}
              {t.carriedFromDate && <ArrowRight className="size-3" />}
              <span>점선으로 표시한 자리예요. 블록을 직접 끌어 옮겨도 돼요.</span>
              {tasks.length > 1 && <b className="text-ink-2">· 남은 제안 {tasks.length}개</b>}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="brand"
            disabled={busy}
            loading={accept.isPending}
            onClick={() => accept.mutate(t.taskId)}
          >
            옮기기
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            loading={decline.isPending}
            onClick={() => decline.mutate(t.taskId)}
          >
            안 옮기기
          </Button>
          {sameDay.length > 1 && (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              disabled={busy}
              loading={acceptAll.isPending}
              onClick={() => acceptAll.mutate(date)}
            >
              {to} {sameDay.length}개 모두 옮기기
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
