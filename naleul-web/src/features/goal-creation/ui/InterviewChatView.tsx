'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { LEAVE_NOTICE } from '../constants'
import { goalFlowPath } from '../routes'
import { useInterviewChat } from '../hooks/useInterviewChat'
import type { SessionDetail } from '../types'
import { AssistantBubble, TypingIndicator, UserBubble } from './ChatBubbles'
import { ChatComposer } from './ChatComposer'
import { FlowHeader } from './FlowHeader'
import { InterviewProgress } from './InterviewProgress'

interface Props {
  initial: SessionDetail
  onResync: () => void
}

/** G-1 목표 대화 */
export function InterviewChatView({ initial, onResync }: Props) {
  const router = useRouter()
  const chat = useInterviewChat({
    initial,
    onResync,
    onNotFound: () => router.replace('/goal/new'),
  })
  const { items, meta, pending, interviewing, canInteract, currentQuestion, rejectedMessage } = chat

  const [leaveOpen, setLeaveOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // 새 말풍선이 생기면 맨 아래로
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [items.length, pending, meta.status, rejectedMessage])

  const leave = () => router.push('/goal')
  const onClose = () => (interviewing ? setLeaveOpen(true) : leave())

  const done = meta.status === 'READY_TO_GENERATE' && !rejectedMessage
  const goReview = () => router.replace(goalFlowPath.review(chat.sessionId))

  // 인터뷰가 끝나면 마지막 말풍선을 잠깐 보여준 뒤 정리 확인 화면(G-2)으로 이동
  useEffect(() => {
    if (!done) return
    const timer = setTimeout(() => router.replace(goalFlowPath.review(chat.sessionId)), 1200)
    return () => clearTimeout(timer)
  }, [done, router, chat.sessionId])

  return (
    <div className="bg-surface flex h-dvh flex-col">
      <FlowHeader
        title="새 목표"
        onClose={onClose}
        center={interviewing && <InterviewProgress current={meta.questionCount} max={meta.maxQuestions} />}
        action={
          interviewing &&
          meta.canFinishEarly && (
            <Button variant="secondary" size="sm" onClick={chat.finishEarly} disabled={!canInteract}>
              <Sparkles className="text-brand size-3.5" />
              <span className="hidden sm:inline">바로 계획 만들기</span>
              <span className="sm:hidden">바로 만들기</span>
            </Button>
          )
        }
      />

      {/* 대화 영역 */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6" role="log" aria-live="polite">
          {items.map((item) =>
            item.role === 'ASSISTANT' ? (
              <AssistantBubble key={item.key} content={item.content} />
            ) : (
              <UserBubble key={item.key} item={item} onRetry={chat.retry} onDiscard={chat.discardFailed} />
            )
          )}

          {/* 마지막 질문의 빠른 답변 */}
          {interviewing && currentQuestion && currentQuestion.quickReplies.length > 0 && !pending && (
            <div className="-mt-1 flex flex-wrap gap-2 pl-[42px]">
              {currentQuestion.quickReplies.map((reply) => (
                <Chip key={reply} onClick={() => chat.sendQuickReply(reply)} disabled={!canInteract}>
                  {reply}
                </Chip>
              ))}
            </div>
          )}

          {pending && <TypingIndicator />}

          {rejectedMessage && (
            <div className="border-line bg-canvas mt-2 rounded-2xl border p-5">
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{rejectedMessage}</p>
              <Button className="mt-4" onClick={() => router.replace('/goal/new')}>
                다른 목표로 시작하기
              </Button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* 하단: 입력창 또는 인터뷰 완료 패널 */}
      <div className="border-line bg-surface border-t pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-3xl px-4 py-3 sm:px-6 sm:py-4">
          {interviewing && (
            <>
              {currentQuestion?.skippable && (
                <div className="mb-2 flex justify-end">
                  <button
                    type="button"
                    onClick={chat.skip}
                    disabled={!canInteract}
                    className="text-ink-3 hover:text-ink rounded-lg px-2 py-1 text-[13px] font-medium disabled:opacity-40"
                  >
                    건너뛰기
                  </button>
                </div>
              )}
              <ChatComposer
                value={chat.input}
                onChange={chat.setInput}
                onSubmit={chat.sendText}
                disabled={!canInteract}
                autoFocus
              />
            </>
          )}

          {done && (
            <div className="flex flex-col items-center gap-3 py-3 text-center sm:flex-row sm:justify-between sm:text-left">
              <p className="flex items-center gap-1.5 text-[15px] font-bold">
                <CheckCircle2 className="text-success size-5" />
                필요한 정보를 모두 모았어요
              </p>
              <Button variant="brand" onClick={goReview}>
                정리 확인하기
              </Button>
            </div>
          )}

          {!interviewing && !done && !rejectedMessage && (
            <p className="text-ink-3 py-2 text-center text-sm">대화가 끝났어요.</p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={leaveOpen}
        title="대화를 잠시 멈출까요?"
        description={LEAVE_NOTICE}
        confirmLabel="나가기"
        cancelLabel="계속 만들기"
        onConfirm={leave}
        onCancel={() => setLeaveOpen(false)}
      />
    </div>
  )
}
