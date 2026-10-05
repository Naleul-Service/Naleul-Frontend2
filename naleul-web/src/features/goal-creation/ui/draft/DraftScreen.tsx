'use client'

import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { goalCreationApi, goalCreationKeys } from '../../api'
import type { GoalPlan, SessionDetail } from '../../types'
import { CenterMessage, FlowShell, SessionGate } from '../SessionGate'
import { DraftReviewView } from './DraftReviewView'

/** /goal/new/[sessionId]/draft — G-4 초안 검토 */
export function DraftScreen({ sessionId }: { sessionId: number }) {
  return (
    <SessionGate sessionId={sessionId} allow={['DRAFT_READY']}>
      {(session) => <DraftLoader session={session} />}
    </SessionGate>
  )
}

function DraftLoader({ session }: { session: SessionDetail }) {
  const draftId = session.latestDraft?.draftId
  const draft = useQuery({
    queryKey: goalCreationKeys.draft(session.sessionId, draftId ?? 0),
    queryFn: () => goalCreationApi.getDraft(session.sessionId, draftId!),
    enabled: !!draftId,
    staleTime: Infinity, // 초안 내용은 바뀌지 않아요 (새 초안은 새 draftId)
  })

  const data = draft.data
  if (data?.plan) {
    // key: 새 초안이 오면 편집 상태를 새로 시작
    return <DraftReviewView key={data.draftId} session={session} draft={{ ...data, plan: data.plan as GoalPlan }} />
  }

  return (
    <FlowShell>
      {draft.isError ? (
        <CenterMessage title="초안을 불러오지 못했어요" description={draft.error.message}>
          <Button onClick={() => draft.refetch()}>다시 시도</Button>
        </CenterMessage>
      ) : (
        <div className="grid flex-1 place-items-center">
          <Spinner className="text-ink-3 size-6" />
        </div>
      )}
    </FlowShell>
  )
}
