'use client'

import { useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/lib/cn'

const MAX_LENGTH = 500

interface ChatComposerProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled?: boolean
  placeholder?: string
  autoFocus?: boolean
}

/**
 * 채팅 입력창. Enter 전송, Shift+Enter 줄바꿈, 내용에 맞춰 높이가 늘어나요.
 *
 * ⚠️ 한글 입력 주의: 한글은 "조합 중"(ㅎ→하→한) 상태에서 Enter 를 누르면
 * keydown 이 한 번 더 발생해요. 조합 중 Enter 를 무시하지 않으면
 * 마지막 글자가 한 번 더 전송되는 버그가 생겨요. → isComposing 으로 막아요.
 */
export function ChatComposer({ value, onChange, onSubmit, disabled, placeholder, autoFocus }: ChatComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [value])

  const canSend = !disabled && value.trim().length > 0

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return
    if (e.nativeEvent.isComposing) return
    e.preventDefault()
    if (canSend) onSubmit()
  }

  const nearLimit = value.length > MAX_LENGTH - 50

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (canSend) onSubmit()
      }}
      className={cn(
        'border-line-strong bg-surface flex items-end gap-2 rounded-[20px] border p-2 pl-4 transition-colors',
        'focus-within:border-ink-3',
        disabled && 'bg-subtle'
      )}
    >
      <textarea
        ref={ref}
        rows={1}
        value={value}
        maxLength={MAX_LENGTH}
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder ?? '답변을 입력하세요'}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        aria-label="답변 입력"
        className="placeholder:text-ink-4 max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2 text-[15px] leading-6 outline-none disabled:cursor-not-allowed"
      />
      {nearLimit && (
        <span className="text-ink-3 self-center text-xs tabular-nums">
          {value.length}/{MAX_LENGTH}
        </span>
      )}
      <button
        type="submit"
        disabled={!canSend}
        aria-label="보내기"
        className="bg-ink grid size-10 shrink-0 place-items-center rounded-full text-white transition-opacity disabled:opacity-25"
      >
        <ArrowUp className="size-5" strokeWidth={2.4} />
      </button>
    </form>
  )
}
