'use client'

import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { Clock, CornerDownLeft, Lock, Timer, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { toast } from '@/stores/toastStore'
import { addDays, formatDuration, formatMonthDay, timeToMinutes } from '@/features/timetable/time'
import { parseLine } from '../parseLine'
import type { TaskQuota } from '../types'

export const MAX_LINES = 20 // 백엔드 한 번에 최대 20개

/** 1단계에서 적은 한 줄. 날짜·시간 칩을 고르면 AI 해석보다 우선해요. */
export interface DumpLine {
  clientKey: string
  text: string
  date: string | null
  /** 날짜를 골랐을 때만 의미: ON = 그날 · DUE = 그날까지 */
  dateType: 'ON' | 'DUE'
  startTime: string | null
  endTime: string | null
  /** 걸리는 시간(분). 시작 시각과 상관없이 "3시간 걸리는 일" — 비워 두면 AI 가 추정해요 */
  minutes: number | null
}

let seq = 0
/**
 * 새 줄. today 를 주면 문장에서 시각·소요 시간·오늘/내일/모레를 바로 읽어 칩을 채워요.
 * 예) "저녁 8시 정기 회의" → 시작 20:00 / "인강 듣기 3시간" → 소요 3시간
 */
export const newLine = (text: string, today?: string): DumpLine => {
  const p = today ? parseLine(text, today) : null
  return {
    clientKey: `c${Date.now().toString(36)}${(seq++).toString(36)}`,
    text: text.slice(0, 200),
    date: p?.date ?? null,
    dateType: 'ON',
    startTime: p?.startTime ?? null,
    endTime: p?.startTime ? p.endTime : null,
    minutes: p?.minutes ?? null,
  }
}

/** 소요 시간 고르기 (분) */
const DURATIONS = [15, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480]

interface Props {
  lines: DumpLine[]
  onChange: (lines: DumpLine[]) => void
  quota?: TaskQuota
  quotaLoading: boolean
  today: string
  loading: boolean
  onNext: () => void
}

/**
 * 1단계 · Task 입력 (명세 3-2)
 *  - 한 줄에 Task 하나. Enter 를 누를 때마다 목록에 추가 (한글 조합 중 Enter 는 무시)
 *  - 여러 줄을 붙여 넣으면 줄마다 나눠서 추가
 *  - Free 한도: 목록 개수가 남은 개수에 닿으면 입력창을 막고 안내
 */
export function StepInput({ lines, onChange, quota, quotaLoading, today, loading, onNext }: Props) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const limit = quota && !quota.premium && quota.remaining != null ? Math.min(quota.remaining, MAX_LINES) : MAX_LINES
  const full = lines.length >= limit
  const freeLimited = !!quota && !quota.premium && quota.remaining != null && lines.length >= quota.remaining

  const add = (texts: string[]) => {
    const clean = texts.map((t) => t.trim()).filter(Boolean)
    if (!clean.length) return
    const room = Math.max(limit - lines.length, 0)
    const accepted = clean.slice(0, room)
    if (accepted.length) onChange([...lines, ...accepted.map((t) => newLine(t, today))])
    if (clean.length > accepted.length) toast.show(`${clean.length - accepted.length}개는 한도를 넘어서 넣지 않았어요.`)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // 한글 조합 중 Enter 는 글자 확정용이라 무시 (안 그러면 마지막 글자가 다음 줄로 넘어가요)
    if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return
    e.preventDefault()
    if (!draft.trim()) {
      if (lines.length && !loading) onNext() // 빈 칸에서 Enter = 다음
      return
    }
    add([draft])
    setDraft('')
  }

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text')
    if (!text.includes('\n')) return
    e.preventDefault()
    add(text.split(/\r?\n/))
  }

  const update = (key: string, patch: Partial<DumpLine>) =>
    onChange(lines.map((l) => (l.clientKey === key ? { ...l, ...patch } : l)))
  const remove = (key: string) => {
    onChange(lines.filter((l) => l.clientKey !== key))
    inputRef.current?.focus()
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-bold">머릿속에 있는 일을 한 줄씩 적어 주세요</h2>
          <p className="text-ink-3 mt-1 text-sm">
            Enter를 누를 때마다 추가돼요. &quot;저녁 8시 정기 회의&quot;, &quot;인강 듣기 3시간&quot;처럼 적으면 시각과
            걸리는 시간을 바로 알아채요. 아래 칩으로 고쳐도 돼요.
          </p>
        </div>
        {quota && !quota.premium && quota.remaining != null && (
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold',
              freeLimited ? 'bg-warning-soft text-[#b45309]' : 'bg-subtle text-ink-2'
            )}
            aria-live="polite"
          >
            {freeLimited
              ? '오늘 추가할 수 있는 만큼 적었어요'
              : `오늘 ${quota.remaining - lines.length}개 더 추가할 수 있어요`}
          </span>
        )}
      </div>

      {lines.length > 0 && (
        <ol className="mt-5 space-y-2" aria-label="입력한 Task">
          {lines.map((l, i) => (
            <LineRow
              key={l.clientKey}
              index={i}
              line={l}
              today={today}
              disabled={loading}
              onChange={(p) => update(l.clientKey, p)}
              onRemove={() => remove(l.clientKey)}
            />
          ))}
        </ol>
      )}

      {/* 입력창 */}
      <div className="mt-4">
        {full ? (
          <div className="border-line-strong bg-subtle flex items-center gap-2 rounded-2xl border border-dashed px-4 py-3.5 text-sm">
            <Lock className="text-ink-3 size-4 shrink-0" />
            {freeLimited ? (
              <span className="text-ink-2">
                {quota?.remaining === 0 ? '오늘은 더 추가할 수 없어요. ' : ''}
                무료 플랜은 하루 {quota?.dailyLimit ?? 2}개까지 추가할 수 있어요 ·{' '}
                <button
                  type="button"
                  onClick={() => toast.show('Pro 플랜은 곧 만나볼 수 있어요.')}
                  className="text-brand font-semibold hover:underline"
                >
                  Pro 알아보기
                </button>
              </span>
            ) : (
              <span className="text-ink-2">한 번에 {MAX_LINES}개까지 정리할 수 있어요.</span>
            )}
          </div>
        ) : (
          <label className="border-line-strong focus-within:border-brand flex items-center gap-2 rounded-2xl border bg-white px-4 py-1.5">
            <span className="text-ink-4 w-5 shrink-0 text-right text-sm tabular-nums">{lines.length + 1}</span>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              disabled={loading || quotaLoading}
              maxLength={200}
              autoFocus
              aria-label="할 일 입력"
              placeholder={
                lines.length ? '다음 할 일 (비워 두고 Enter = 다음 단계)' : '예) 저녁 8시 정기 회의 · 인강 듣기 3시간'
              }
              className="placeholder:text-ink-4 h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none"
            />
            <button
              type="button"
              onClick={() => {
                add([draft])
                setDraft('')
                inputRef.current?.focus()
              }}
              disabled={!draft.trim()}
              aria-label="추가"
              className="text-ink-3 hover:bg-subtle hover:text-ink rounded-lg p-2 disabled:opacity-30"
            >
              <CornerDownLeft className="size-4" />
            </button>
          </label>
        )}
      </div>

      <div className="mt-6 flex items-center justify-end gap-3">
        {loading && (
          <span className="text-ink-3 flex items-center gap-2 text-sm" aria-live="polite">
            <Spinner className="size-4" />
            AI가 목표와 연결하고 있어요…
          </span>
        )}
        <Button onClick={onNext} disabled={!lines.length || loading} loading={loading}>
          다음 · 목표 연결
        </Button>
      </div>
    </Card>
  )
}

function LineRow({
  index,
  line,
  today,
  disabled,
  onChange,
  onRemove,
}: {
  index: number
  line: DumpLine
  today: string
  disabled: boolean
  onChange: (p: Partial<DumpLine>) => void
  onRemove: () => void
}) {
  const [showTime, setShowTime] = useState(!!line.startTime)
  const tomorrow = addDays(today, 1)
  const pick = (d: string | null) => onChange({ date: line.date === d ? null : d })

  return (
    <li className="border-line rounded-2xl border px-3 py-2.5" data-line={index}>
      <div className="flex items-center gap-2">
        <span className="text-ink-4 w-5 shrink-0 text-right text-sm tabular-nums">{index + 1}</span>
        <input
          value={line.text}
          onChange={(e) => onChange({ text: e.target.value.slice(0, 200) })}
          disabled={disabled}
          aria-label={`${index + 1}번 할 일`}
          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none"
        />
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`${index + 1}번 삭제`}
          className="text-ink-4 hover:bg-subtle hover:text-ink rounded-lg p-1.5"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-7">
        <Chip size="sm" selected={line.date === today} onClick={() => pick(today)} disabled={disabled}>
          오늘
        </Chip>
        <Chip size="sm" selected={line.date === tomorrow} onClick={() => pick(tomorrow)} disabled={disabled}>
          내일
        </Chip>
        {/* 칩 모양 위에 투명한 날짜 입력을 겹쳐서, 누르면 달력이 열려요 */}
        <span
          className={cn(
            'relative inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium',
            line.date && line.date !== today && line.date !== tomorrow
              ? 'border-brand bg-brand text-white'
              : 'border-line-strong text-ink-2 hover:border-ink-4'
          )}
        >
          {line.date && line.date !== today && line.date !== tomorrow ? formatMonthDay(line.date) : '날짜 선택'}
          <input
            type="date"
            min={today}
            value={line.date ?? ''}
            onChange={(e) => onChange({ date: e.target.value || null })}
            onClick={(e) => e.currentTarget.showPicker?.()}
            disabled={disabled}
            aria-label={`${index + 1}번 날짜`}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </span>
        {line.date && (
          <Chip
            size="sm"
            selected={line.dateType === 'DUE'}
            onClick={() =>
              onChange({ dateType: line.dateType === 'DUE' ? 'ON' : 'DUE', startTime: null, endTime: null })
            }
            disabled={disabled}
          >
            ~까지
          </Chip>
        )}
        {line.dateType !== 'DUE' && (
          <Chip
            size="sm"
            selected={showTime}
            onClick={() => {
              if (showTime) onChange({ startTime: null, endTime: null })
              setShowTime(!showTime)
            }}
            disabled={disabled}
          >
            <Clock className="mr-1 size-3" />
            시간
          </Chip>
        )}
        {showTime && line.dateType !== 'DUE' && (
          <span className="flex items-center gap-1 text-xs">
            <input
              type="time"
              step={600}
              value={line.startTime ?? ''}
              onChange={(e) => onChange({ startTime: e.target.value || null })}
              aria-label={`${index + 1}번 시작 시각`}
              className="border-line-strong h-7 rounded-lg border px-1.5"
            />
            ~
            <input
              type="time"
              step={600}
              value={line.endTime ?? ''}
              onChange={(e) => onChange({ endTime: e.target.value || null })}
              aria-label={`${index + 1}번 종료 시각`}
              className="border-line-strong h-7 rounded-lg border px-1.5"
            />
          </span>
        )}
        <DurationChip line={line} index={index} disabled={disabled} onChange={(minutes) => onChange({ minutes })} />
      </div>
    </li>
  )
}

/**
 * 걸리는 시간 칩. 시작 시각을 몰라도 "3시간 걸리는 일"이면 자동 배치가 3시간짜리 빈칸을 찾아 넣어요.
 * 시작·종료를 둘 다 고르면 그 차이가 소요 시간이라 여기서는 보여주기만 해요.
 */
function DurationChip({
  line,
  index,
  disabled,
  onChange,
}: {
  line: DumpLine
  index: number
  disabled: boolean
  onChange: (minutes: number | null) => void
}) {
  const fixed =
    line.dateType !== 'DUE' && line.startTime && line.endTime
      ? (timeToMinutes(line.endTime) - timeToMinutes(line.startTime) + 1440) % 1440 || null
      : null
  const value = fixed ?? line.minutes
  const options = [...new Set([...DURATIONS, ...(line.minutes ? [line.minutes] : [])])].sort((a, b) => a - b)

  return (
    <span
      className={cn(
        'relative inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium',
        value ? 'border-brand bg-brand text-white' : 'border-line-strong text-ink-2 hover:border-ink-4',
        fixed && 'opacity-80'
      )}
      title={fixed ? '시작·종료 시각으로 정해져요' : '걸리는 시간 (비워 두면 AI가 추정)'}
    >
      <Timer className="size-3" />
      {value ? formatDuration(value) : '걸리는 시간'}
      {/* 칩 위에 투명한 select 를 겹쳐서 누르면 목록이 열려요 */}
      <select
        value={line.minutes ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        disabled={disabled || !!fixed}
        aria-label={`${index + 1}번 걸리는 시간`}
        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-default"
      >
        <option value="">AI가 추정</option>
        {options.map((m) => (
          <option key={m} value={m}>
            {formatDuration(m)}
          </option>
        ))}
      </select>
    </span>
  )
}
