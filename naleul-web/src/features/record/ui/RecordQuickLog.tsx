'use client'

import { useState, type KeyboardEvent } from 'react'
import { Clock, CornerDownLeft, Timer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { toast } from '@/stores/toastStore'
import { parseLine } from '@/features/brain-dump/parseLine'
import { formatDuration, todayKst } from '@/features/timetable/time'
import type { GoalCategory } from '@/features/goal/api'
import { newClientKey, useLogActivities } from '../api'

const EXAMPLES = ['주간 회의 1시간', '오후 2시 기획서 작성 2시간', '어제 코드 리뷰 30분']

/**
 * 기록형 목표 상세 — "오늘 한 일" 한 줄 기록.
 * Task 추가(Brain dump)처럼 문장만 적으면 시각·걸린 시간을 읽어서 바로 저장해요.
 *  - "저녁 8시 나를 회의 1시간" → 20:00~21:00
 *  - "운동 30분"                → 방금 끝낸 30분
 *  - "어제 코드 리뷰 30분"       → 어제
 * 목표가 이미 정해져 있으니 AI 없이 바로 저장해요 (그래서 빨라요).
 */
export function RecordQuickLog({ goal }: { goal: GoalCategory }) {
  const [text, setText] = useState('')
  const log = useLogActivities()
  const value = text.trim()
  const preview = value ? parseLine(value, todayKst()) : null

  const submit = () => {
    if (!value || log.isPending) return
    log.mutate(
      {
        items: [
          {
            clientKey: newClientKey(),
            text: value,
            goalCategoryId: goal.goalCategoryId,
          },
        ],
      },
      {
        onSuccess: (res) => {
          setText('')
          const a = res.activities[0]
          // 서버가 정한 시간을 알려줘야 "시간 없이 적으면 어떻게 되지?"가 풀려요
          if (a) toast.success(`기록했어요 · ${a.startAt.slice(11, 16)}–${a.endAt.slice(11, 16)}`)
        },
      }
    )
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-[17px] font-bold">오늘 한 일 기록하기</h2>
      <p className="text-ink-3 mt-1 text-[13px]">
        한 줄로 적으면 시각·걸린 시간을 알아서 읽어요. 시각이 없으면 방금 끝낸 일로 기록돼요.
      </p>

      <div className="border-line-strong bg-surface focus-within:border-ink-3 mt-4 flex items-center gap-2 rounded-2xl border px-3 py-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          maxLength={200}
          placeholder={`예) ${EXAMPLES[0]}`}
          aria-label="한 일"
          className="placeholder:text-ink-4 h-9 min-w-0 flex-1 bg-transparent text-[15px] outline-none"
          disabled={log.isPending}
        />
        <Button size="sm" onClick={submit} loading={log.isPending} disabled={!value}>
          <CornerDownLeft className="size-3.5" />
          기록
        </Button>
      </div>

      {/* 읽은 결과 미리보기 */}
      <div className="mt-2 flex min-h-6 flex-wrap items-center gap-1.5 text-[12px]">
        {preview && (preview.startTime || preview.minutes) ? (
          <>
            {preview.startTime && (
              <span className="bg-subtle text-ink-2 inline-flex h-6 items-center gap-1 rounded-full px-2 font-semibold">
                <Clock className="size-3" />
                {preview.startTime}
                {preview.endTime ? `–${preview.endTime}` : ''}
              </span>
            )}
            {preview.minutes && (
              <span className="bg-subtle text-ink-2 inline-flex h-6 items-center gap-1 rounded-full px-2 font-semibold">
                <Timer className="size-3" />
                {formatDuration(preview.minutes)}
              </span>
            )}
          </>
        ) : (
          !value &&
          EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setText(ex)}
              className="border-line text-ink-3 hover:border-line-strong hover:text-ink-2 h-6 rounded-full border px-2"
            >
              {ex}
            </button>
          ))
        )}
      </div>
    </Card>
  )
}
