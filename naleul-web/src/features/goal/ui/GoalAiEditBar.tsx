'use client'

import { useEffect, useRef, useState } from 'react'
import { CornerDownLeft, MessageSquareText } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Chip'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import type { GoalCategory } from '../api'
import { useGoalEditApply, useGoalEditPreview, type GoalEditPreview } from '../edit/mutations'
import { AI_EDIT_PREFILL_EVENT } from './progress/DailyCheckInCard'

const MAX = 200
const EXAMPLES = [
  '최근 기록 보고 계획 조정해줘',
  '운동은 주 2회로 줄여줘',
  '종료일 2주 늦춰줘',
  '아침 7시에 스트레칭 10분 추가해줘',
]
const ACTION_TONE: Record<string, 'brand' | 'neutral' | 'danger'> = { 추가: 'brand', 변경: 'neutral', 삭제: 'danger' }

/**
 * 목표 상세 "말로 고치기".
 * 트리 구조(영역 → 루틴 → 점검 시점)나 수치 계산 방식을 몰라도 한 문장으로 고칠 수 있게 해요.
 *  1) 문장을 보내면 AI 가 "바뀔 항목 목록"을 만들어요 — 이때는 아무것도 안 바뀌어요
 *  2) 바뀌기 전/후를 보고 원하는 것만 골라 [적용]
 * 실행 중인 목표라 바로 바꾸지 않고 꼭 확인을 거쳐요.
 */
export function GoalAiEditBar({ goal }: { goal: GoalCategory }) {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<GoalEditPreview | null>(null)
  const [picked, setPicked] = useState<boolean[]>([])
  const ask = useGoalEditPreview(goal.goalCategoryId)
  const apply = useGoalEditApply(goal.goalCategoryId)
  const inputRef = useRef<HTMLInputElement>(null)

  // "오늘 기록" 카드의 "최근 기록 보고 계획 조정받기" → 문장을 채우고 이 칸으로 이동
  useEffect(() => {
    const onPrefill = (e: Event) => {
      const v = (e as CustomEvent<string>).detail
      if (!v) return
      setText(v.slice(0, MAX))
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      inputRef.current?.focus()
    }
    window.addEventListener(AI_EDIT_PREFILL_EVENT, onPrefill)
    return () => window.removeEventListener(AI_EDIT_PREFILL_EVENT, onPrefill)
  }, [])

  const submit = () => {
    const value = text.trim()
    if (!value || ask.isPending) return
    ask.mutate(value, {
      onSuccess: (res) => {
        setPreview(res)
        setPicked(res.changes.map(() => true))
      },
    })
  }

  const close = () => {
    if (apply.isPending) return
    setPreview(null)
  }

  const chosen = preview ? preview.changes.filter((_, i) => picked[i]).map((c) => c.op) : []
  const doApply = () =>
    apply.mutate(chosen, {
      onSuccess: () => {
        setPreview(null)
        setText('')
      },
    })

  return (
    <section className="border-line bg-surface rounded-[20px] border px-4 py-3 sm:px-5">
      <div className="flex items-center gap-2">
        <MessageSquareText className="text-brand size-5 shrink-0" />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          disabled={ask.isPending}
          placeholder="바꾸고 싶은 걸 말로 적어 보세요. 예) 운동은 주 2회로 줄여줘"
          aria-label="말로 고치기"
          className="placeholder:text-ink-4 h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none"
        />
        <Button size="sm" variant="brand" onClick={submit} loading={ask.isPending} disabled={!text.trim()}>
          <CornerDownLeft className="size-3.5" />
          고치기
        </Button>
      </div>
      {!text && (
        <div className="mt-1.5 flex flex-wrap gap-1.5 pl-7">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setText(ex)}
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
        title="이렇게 바꿀까요?"
        description={preview?.summary}
        size="lg"
        dismissible={!apply.isPending}
        footer={
          preview?.changes.length ? (
            <>
              <Button variant="secondary" onClick={close} disabled={apply.isPending}>
                취소
              </Button>
              <Button onClick={doApply} loading={apply.isPending} disabled={!chosen.length}>
                {chosen.length}개 적용
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={close}>
              다시 적기
            </Button>
          )
        }
      >
        {preview && preview.changes.length > 0 && (
          <>
            <p className="text-ink-3 mb-3 text-[13px]">아직 아무것도 바뀌지 않았어요. 적용할 항목만 체크해 주세요.</p>
            <ul className="space-y-2">
              {preview.changes.map((c, i) => (
                <li key={i}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors',
                      picked[i] ? 'border-ink/30 bg-surface' : 'border-line bg-canvas opacity-60'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={!!picked[i]}
                      onChange={(e) => setPicked((p) => p.map((v, j) => (j === i ? e.target.checked : v)))}
                      className="mt-1 size-4 shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <Badge tone={ACTION_TONE[c.action] ?? 'neutral'} className="h-5 px-2 text-[11px]">
                          {c.action}
                        </Badge>
                        <span className="text-[14px] font-semibold">{c.target}</span>
                      </span>
                      {c.before && (
                        <span className="text-ink-3 mt-1 block text-[13px] line-through decoration-1">{c.before}</span>
                      )}
                      {c.after && <span className="text-ink mt-0.5 block text-[14px]">{c.after}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
      </Modal>
    </section>
  )
}
