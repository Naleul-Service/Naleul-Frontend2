'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { formatDuration, minutesFrom, minutesToTime, timeToMinutes } from '../time'
import type { TimeBlockTask } from '../types'
import type { TimeValue } from './TimeEditModal'

/** 실제로 한 구간 — 그날 0시 기준 분 (end 가 1440 이상이면 다음 날) */
export interface ActualSegment {
  start: number
  end: number
}

const inputClass =
  'border-line-strong focus:border-brand h-11 w-full rounded-xl border bg-surface px-3 text-[15px] outline-none'

const MAX_SEGMENTS = 10

/** 입력 행 → 분 범위. 끝 ≤ 시작이면 끝은 다음 날, 앞 구간보다 이르게 시작하면 그 구간부터 다음 날 */
function parseRows(rows: { start: string; end: string }[]) {
  const out: { start: number; end: number }[] = []
  let offset = 0
  let prevStart = -Infinity
  for (const r of rows) {
    let s = r.start ? timeToMinutes(r.start) : NaN
    let e = r.end ? timeToMinutes(r.end) : NaN
    if (!Number.isNaN(s) && s + offset < prevStart) offset += 1440
    s += offset
    e += offset
    if (e <= s) e += 1440
    prevStart = s
    out.push({ start: s, end: e })
  }
  return out
}

/**
 * "실제로 한 시간" 기록 — 한 번에 했으면 한 줄, 중간에 쉬었다가 이어서 했으면 "나눠서 했어요"로 여러 줄.
 * 예) 계획 13:00~18:00 → 실제 13:00~15:00, 16:00~18:00
 * 자정을 넘겨도 돼요 (21:30~22:00, 23:00~00:00 / 23:30~00:30). 구간끼리는 겹치지 않게.
 */
export function ActualTimeModal({
  task,
  date,
  initial,
  loading,
  onSubmit,
  onClose,
}: {
  task: TimeBlockTask
  date: string
  initial: TimeValue
  loading?: boolean
  onSubmit: (segments: ActualSegment[]) => void
  onClose: () => void
}) {
  const saved = (task.actualSegments ?? []).map((g) => ({
    start: minutesToTime(minutesFrom(date, g.start)),
    end: minutesToTime(minutesFrom(date, g.end)),
  }))
  const [rows, setRows] = useState(
    saved.length > 1 ? saved : [{ start: minutesToTime(initial.start), end: minutesToTime(initial.end) }]
  )

  // 자정을 넘기는 구간도 돼요: 끝이 시작보다 이르거나 같으면(23:00 ~ 00:00) 끝은 다음 날,
  // 앞 구간보다 이른 시각에 시작하면(23:00 ~ 23:30 다음 00:30 ~ 01:00) 그 구간은 통째로 다음 날로 봐요
  const parsed = parseRows(rows)
  const error = (() => {
    if (parsed.some((p) => Number.isNaN(p.start) || Number.isNaN(p.end)))
      return '시작과 종료 시각을 모두 입력해 주세요.'
    if (parsed.some((p) => p.end <= p.start)) return '종료 시각이 시작보다 뒤여야 해요.'
    if (parsed.some((p) => p.end - p.start > 1440)) return '한 구간은 하루를 넘을 수 없어요.'
    const sorted = [...parsed].sort((a, b) => a.start - b.start)
    if (sorted.some((p, i) => i > 0 && p.start < sorted[i - 1].end)) return '구간끼리 겹치지 않게 입력해 주세요.'
    return null
  })()
  const total = error ? 0 : parsed.reduce((sum, p) => sum + p.end - p.start, 0)

  const update = (i: number, key: 'start' | 'end', v: string) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, [key]: v } : r)))
  const addRow = () =>
    setRows((prev) => {
      const last = prev[prev.length - 1]
      // 직전 구간이 끝나고 30분 뒤부터 1시간으로 제안
      const base = last?.end ? timeToMinutes(last.end) + 30 : initial.end
      const s = Math.min(base, 1440 - 60)
      return [...prev, { start: minutesToTime(s), end: minutesToTime(s + 60) }]
    })
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, j) => j !== i))
  const submit = () => {
    if (error) return
    onSubmit([...parsed].sort((a, b) => a.start - b.start))
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="실제로 한 시간"
      description="실제로 시작하고 끝낸 시각을 남기면 완료로 표시되고, 나의 패턴이 더 정확해져요. 중간에 쉬었다가 이어서 했으면 나눠서 적어 주세요."
      size="sm"
      dismissible={!loading}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            취소
          </Button>
          <Button onClick={submit} disabled={!!error} loading={loading}>
            저장
          </Button>
        </>
      }
    >
      <form
        className="space-y-2"
        onSubmit={(ev) => {
          ev.preventDefault()
          submit()
        }}
      >
        {rows.map((r, i) => (
          <div key={i} className="flex items-end gap-2">
            <label className="block flex-1">
              {i === 0 && <span className="text-ink-3 mb-1 block text-xs font-medium">시작</span>}
              <input
                type="time"
                step={600}
                value={r.start}
                onChange={(ev) => update(i, 'start', ev.target.value)}
                className={inputClass}
                required
                aria-label={`${i + 1}번째 구간 시작`}
              />
            </label>
            <label className="block flex-1">
              {i === 0 && <span className="text-ink-3 mb-1 block text-xs font-medium">종료</span>}
              <input
                type="time"
                step={600}
                value={r.end}
                onChange={(ev) => update(i, 'end', ev.target.value)}
                className={inputClass}
                required
                aria-label={`${i + 1}번째 구간 종료`}
              />
            </label>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(i)}
                aria-label={`${i + 1}번째 구간 지우기`}
                className="text-ink-3 hover:bg-subtle hover:text-ink grid h-11 w-9 shrink-0 place-items-center rounded-lg"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        ))}
        {rows.length < MAX_SEGMENTS && (
          <button
            type="button"
            onClick={addRow}
            className="text-brand flex items-center gap-1 pt-1 text-[13px] font-semibold"
          >
            <Plus className="size-4" />
            {rows.length === 1 ? '나눠서 했어요 (구간 추가)' : '구간 추가'}
          </button>
        )}
        <p className={error ? 'text-danger min-h-5 text-xs' : 'text-ink-3 min-h-5 text-xs'}>
          {error ?? `${rows.length > 1 ? `${rows.length}번에 나눠서 · ` : ''}총 ${formatDuration(total)}`}
        </p>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
