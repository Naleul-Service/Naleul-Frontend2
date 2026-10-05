import type { SessionStatus } from './types'

/** 세션 상태에 맞는 화면 경로 */
export const goalFlowPath = {
  start: () => '/goal/new',
  chat: (id: number) => `/goal/new/${id}`,
  review: (id: number) => `/goal/new/${id}/review`,
  generating: (id: number, draftId?: number) => `/goal/new/${id}/generating${draftId ? `?draftId=${draftId}` : ''}`,
  draft: (id: number) => `/goal/new/${id}/draft`,
}

export function pathForStatus(id: number, status: SessionStatus): string | null {
  switch (status) {
    case 'INTERVIEWING':
      return goalFlowPath.chat(id)
    case 'READY_TO_GENERATE':
      return goalFlowPath.review(id)
    case 'GENERATING':
      return goalFlowPath.generating(id)
    case 'DRAFT_READY':
      return goalFlowPath.draft(id)
    default:
      return null // CONFIRMED / ABANDONED → 이어갈 화면 없음
  }
}
