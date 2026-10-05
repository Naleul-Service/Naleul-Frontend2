'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'
import { goalCreationApi, goalCreationKeys } from '../api'
import { pathForStatus } from '../routes'
import type { SessionStatus } from '../types'

const STEP_LABEL: Partial<Record<SessionStatus, string>> = {
  INTERVIEWING: 'AI와 대화하는 중',
  READY_TO_GENERATE: '정리 확인 단계',
  GENERATING: '계획을 만드는 중',
  DRAFT_READY: '초안이 준비됐어요',
}

/** 만들던 목표가 있으면 "이어서 만들기" 카드 (없으면 아무것도 안 그림) */
export function ResumeCard({ className }: { className?: string }) {
  const active = useQuery({
    queryKey: goalCreationKeys.active(),
    queryFn: goalCreationApi.getActive,
    staleTime: 0,
  })
  const session = active.data
  const href = session ? pathForStatus(session.sessionId, session.status) : null
  if (!session || !href) return null

  return (
    <Link
      href={href}
      className={cn(
        'border-line bg-surface hover:border-line-strong flex items-center gap-4 rounded-2xl border p-4 transition-colors',
        className
      )}
    >
      <span className="bg-brand-soft text-brand grid size-10 shrink-0 place-items-center rounded-full">
        <Sparkles className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-ink-3 block text-[13px]">만들던 목표가 있어요 · {STEP_LABEL[session.status] ?? ''}</span>
        <span className="block truncate text-[15px] font-bold">
          {session.slots.goalStatement.value ?? '이름 없는 목표'}
        </span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold">
        이어서 만들기
        <ArrowRight className="size-4" />
      </span>
    </Link>
  )
}
