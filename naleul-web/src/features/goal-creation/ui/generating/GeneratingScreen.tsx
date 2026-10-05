'use client'

import { SessionGate } from '../SessionGate'
import { GeneratingView } from './GeneratingView'

/**
 * /goal/new/[sessionId]/generating?draftId=
 * - draftId 가 있으면 바로 폴링 (계획 만들기 직후)
 * - 없으면 세션의 최신 초안을 찾아서 폴링 (이어서 만들기 / 새로고침)
 */
export function GeneratingScreen({ sessionId, draftId }: { sessionId: number; draftId: number | null }) {
  if (draftId) return <GeneratingView key={draftId} sessionId={sessionId} draftId={draftId} />

  return (
    <SessionGate sessionId={sessionId} allow={['GENERATING']}>
      {(session) =>
        session.latestDraft ? (
          <GeneratingView
            key={session.latestDraft.draftId}
            sessionId={sessionId}
            draftId={session.latestDraft.draftId}
          />
        ) : null
      }
    </SessionGate>
  )
}
