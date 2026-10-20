'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, CornerDownLeft } from 'lucide-react'
import { Repeat } from '@/components/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Modal, type ModalCloseMethod } from '@/components/ui/Modal'
import { track } from '@/lib/client/analytics'
import { errorStatusOf } from '@/features/home/analytics'
import { api, isApiError } from '@/lib/client/api'
import { cn } from '@/lib/cn'
import { toast } from '@/stores/toastStore'
import { goalKeys } from '@/features/goal/api'
import { timetableKeys } from '../api'
import { goalAccent } from '@/lib/goalTone'
import { AIBadge } from '@/components/ui/AIBadge'

// ── API (POST /timetable/ai-edit/preview · /apply) ─────────────────────

export interface ScheduleEditOp {
  type: 'MOVE_ROUTINE' | 'MOVE_TASK'
  targetId: number
  days: string[] | null
  startTime: string | null
  durationMinutes: number | null
  date: string | null
}

export interface ScheduleEditChange {
  op: ScheduleEditOp
  kind: 'ROUTINE' | 'TASK'
  target: string
  goal: string | null
  colorCode: string | null
  before: string
  after: string
}

export interface ScheduleEditPreview {
  summary: string
  changes: ScheduleEditChange[]
  /** 지금 겹쳐 있는 루틴 — "화 16:30–17:00 '기출 풀기' · 'SQL 문제'" */
  overlaps: string[]
}

const errorMessage = (e: unknown) => (isApiError(e) ? e.message : '문제가 생겼어요. 다시 시도해 주세요.')

function useScheduleEditPreview() {
  return useMutation({
    mutationFn: (v: { instruction: string; startDate: string; endDate: string }) =>
      api.post<ScheduleEditPreview>('/v1/timetable/ai-edit/preview', v),
    onError: (e) => toast.error(errorMessage(e)),
  })
}

function useScheduleEditApply() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { ops: ScheduleEditOp[]; startDate: string; endDate: string }) =>
      api.post<{ applied: number; skipped: string[] }>('/v1/timetable/ai-edit/apply', v),
    onSuccess: (r) => {
      const applied = r?.applied ?? 0
      const skipped = r?.skipped ?? []
      if (applied)
        toast.success(`${applied}개를 옮겼어요.${skipped.length ? ` ${skipped.length}개는 못 옮겼어요.` : ''}`)
      else toast.error(skipped[0] ?? '옮긴 일정이 없어요.')
    },
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: timetableKeys.all })
      // 루틴 시간이 바뀌면 목표 상세 · 홈 · 업무형 패턴도
      qc.invalidateQueries({ queryKey: goalKeys.all })
      qc.invalidateQueries({ queryKey: ['home'] })
      qc.invalidateQueries({ queryKey: ['record'] })
    },
  })
}

// ── 화면 ────────────────────────────────────────────────────

const MAX = 300
const EXAMPLES = ['겹치는 루틴 정리해줘', '이번 주 운동 루틴은 저녁 8시로 옮겨줘', '내일 할 일을 오후로 몰아줘']

/**
 * 캘린더 "AI로 일정 조정" — 여러 목표의 루틴 · 일정을 한 문장으로 한꺼번에 옮겨요.
 *  1) 문장을 보내면 AI 가 "옮길 항목 목록"을 만들어요 (보고 있는 주/날의 일정 + 모든 루틴 기준) — 이때는 아무것도 안 바뀌어요
 *  2) 전/후를 보고 원하는 것만 골라 [적용]
 * 루틴 변경은 "앞으로 계속", Task 변경은 그날만 바뀌어요.
 * ?ai=문장 으로 들어오면(루틴 폼의 "AI로 한 번에 정리") 입력칸에 채워 둬요 (보내기는 사용자가).
 */
export function ScheduleAiBar({
  startDate,
  endDate,
  viewMode,
}: {
  startDate: string
  endDate: string
  /** 캘린더 보기 (calendar_ai.submit 의 view_mode) */
  viewMode?: 'day' | 'week' | 'month'
}) {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<ScheduleEditPreview | null>(null)
  const [picked, setPicked] = useState<boolean[]>([])
  const ask = useScheduleEditPreview()
  const apply = useScheduleEditApply()
  const inputRef = useRef<HTMLInputElement>(null)
  // ?ai= 로 채워 둔 문장 (calendar_ai.submit 의 is_prefilled)
  const prefilledRef = useRef<string | null>(null)

  const send = (value: string) => {
    const v = value.trim()
    if (!v || ask.isPending) return
    ask.mutate(
      { instruction: v, startDate, endDate },
      {
        onSuccess: (res) => {
          track('calendar_ai.preview_result', {
            result: 'success',
            change_count: res?.changes.length ?? 0,
            overlap_count: res?.overlaps.length ?? 0,
          })
          if (!res) return
          setPreview(res)
          setPicked(res.changes.map(() => true))
        },
        onError: (e) => track('calendar_ai.preview_result', { result: 'fail', error_status: errorStatusOf(e) }),
      }
    )
  }
  // 입력칸 Enter · '조정하기' 버튼
  const submit = (method: 'button' | 'enter') => {
    const v = text.trim()
    if (!v || ask.isPending) return
    track('calendar_ai.submit', {
      view_mode: viewMode,
      text_length: v.length,
      is_prefilled: prefilledRef.current != null && text === prefilledRef.current,
      submit_method: method,
    })
    send(text)
  }

  // 루틴 폼에서 "캘린더에서 AI로 한 번에 정리"로 왔을 때 — 문장을 채우고 주소에서는 지워요
  const prefill = params.get('ai')
  useEffect(() => {
    if (!prefill) return
    const v = prefill.slice(0, MAX)
    const q = new URLSearchParams(params.toString())
    q.delete('ai')
    router.replace(`${pathname}?${q.toString()}`, { scroll: false })
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 주소로 받은 문장을 한 번만 옮겨 담아요
    setText(v)
    prefilledRef.current = v
    inputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill])

  const close = (method: ModalCloseMethod | 'cancel_button') => {
    if (apply.isPending) return
    if (preview) track('calendar_ai.cancel', { close_method: method, change_count: preview.changes.length })
    setPreview(null)
  }
  const chosen = preview ? preview.changes.filter((_, i) => picked[i]).map((c) => c.op) : []
  const doApply = () => {
    track('calendar_ai.apply_click', { selected_count: chosen.length, change_count: preview?.changes.length ?? 0 })
    apply.mutate(
      { ops: chosen, startDate, endDate },
      {
        onSuccess: (r) => {
          track('calendar_ai.apply_result', {
            result: 'success',
            applied_count: r?.applied ?? 0,
            skipped_count: r?.skipped?.length ?? 0,
          })
          setPreview(null)
          setText('')
        },
        onError: (e) => track('calendar_ai.apply_result', { result: 'fail', error_status: errorStatusOf(e) }),
      }
    )
  }

  return (
    // AI 요청 바 (명세 6B) — 그라데이션 테두리
    <section className="ai-border-flat rounded-card mb-3 px-4 py-2.5 sm:px-5">
      <div className="flex items-center gap-2">
        <AIBadge size="sm" />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit('enter')
            }
          }}
          disabled={ask.isPending}
          placeholder="AI로 일정 조정 — 예) 겹치는 루틴 정리해줘 · 운동 루틴은 전부 저녁 8시로"
          aria-label="AI로 일정 조정"
          className="placeholder:text-text-placeholder h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none"
        />
        <Button
          size="sm"
          variant="ai"
          onClick={() => submit('button')}
          loading={ask.isPending}
          disabled={!text.trim()}
        >
          <CornerDownLeft className="size-3.5" />
          조정하기
        </Button>
      </div>
      {!text && (
        <div className="mt-1 mb-0.5 flex flex-wrap gap-1.5 pl-7">
          {EXAMPLES.map((ex, i) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                track('calendar_ai.example_click', { example_index: i })
                setText(ex)
              }}
              className="border-line text-ink-3 hover:border-line-strong hover:text-ink-2 h-6 rounded-full border px-2 text-[12px]"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      <Modal
        open={!!preview}
        onClose={close}
        title="이렇게 옮길까요?"
        description={preview?.summary}
        size="lg"
        dismissible={!apply.isPending}
        footer={
          preview?.changes.length ? (
            <>
              <Button variant="secondary" onClick={() => close('cancel_button')} disabled={apply.isPending}>
                취소
              </Button>
              <Button onClick={doApply} loading={apply.isPending} disabled={!chosen.length}>
                {chosen.length}개 적용
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => close('cancel_button')}>
              다시 적기
            </Button>
          )
        }
      >
        {preview && (
          <>
            {preview.changes.length > 0 && (
              <>
                <p className="text-ink-3 mb-3 text-[13px]">
                  아직 아무것도 바뀌지 않았어요. 적용할 항목만 체크해 주세요.
                </p>
                <ul className="space-y-2">
                  {preview.changes.map((c, i) => (
                    <li key={i}>
                      <label
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors',
                          picked[i] ? 'border-ink/30 bg-surface' : 'border-line bg-bg-sunken opacity-60'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={!!picked[i]}
                          onChange={(e) => {
                            const checked = e.target.checked
                            track('calendar_ai.item_toggle', { change_kind: c.kind, checked })
                            setPicked((p) => p.map((v, j) => (j === i ? checked : v)))
                          }}
                          className="mt-1 size-4 shrink-0"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-1.5">
                            {c.kind === 'ROUTINE' && <Repeat className="text-text-brand size-3.5" aria-label="루틴" />}
                            <span className="text-[14px] font-semibold">{c.target}</span>
                            {c.goal && (
                              <span className="text-ink-3 flex items-center gap-1 text-[12px]">
                                <span
                                  className="size-2 rounded-full"
                                  style={{ backgroundColor: goalAccent(c.colorCode) }}
                                  aria-hidden
                                />
                                {c.goal}
                              </span>
                            )}
                          </span>
                          <span className="text-ink-3 mt-1 block text-[13px] line-through decoration-1">
                            {c.before}
                          </span>
                          <span className="text-ink mt-0.5 block text-[14px]">{c.after}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {preview.overlaps.length > 0 && (
              <div className="bg-warning-soft mt-4 rounded-xl px-3 py-2.5 text-[13px]">
                <p className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="text-warning size-4" />
                  지금 겹쳐 있는 루틴 {preview.overlaps.length}
                </p>
                <ul className="text-ink-2 mt-1 space-y-0.5 pl-6">
                  {preview.overlaps.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
                {preview.changes.length === 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      track('calendar_ai.overlap_fix_click', { overlap_count: preview.overlaps.length })
                      setPreview(null)
                      send('겹치는 루틴 정리해줘')
                    }}
                    className="text-text-brand mt-1.5 pl-6 text-[12px] font-semibold hover:underline"
                  >
                    겹치는 루틴 정리해 달라고 하기
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </Modal>
    </section>
  )
}
