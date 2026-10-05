'use client'

import { useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Button, buttonClass } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { isApiError } from '@/lib/client/api'
import { goalCreationApi, goalCreationKeys } from '../api'
import { goalFlowPath, pathForStatus } from '../routes'
import type { SessionDetail, SessionStatus } from '../types'
import { FlowHeader } from './FlowHeader'

export function useGoalSession(sessionId: number) {
  return useQuery({
    queryKey: goalCreationKeys.session(sessionId),
    queryFn: () => goalCreationApi.getSession(sessionId),
    staleTime: 0, // 화면에 들어올 때마다 서버 최신 상태로
  })
}

export function FlowShell({ children, onClose, wide }: { children: ReactNode; onClose?: () => void; wide?: boolean }) {
  const router = useRouter()
  return (
    <div className="bg-surface flex h-dvh flex-col">
      <FlowHeader title="새 목표" wide={wide} onClose={onClose ?? (() => router.push('/goal'))} />
      {children}
    </div>
  )
}

export function CenterMessage({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <div className="grid flex-1 place-items-center px-4 text-center">
      <div className="max-w-sm">
        <p className="text-lg font-bold">{title}</p>
        {description && <p className="text-ink-3 mt-2 text-sm leading-relaxed">{description}</p>}
        {children && <div className="mt-6 flex justify-center gap-2">{children}</div>}
      </div>
    </div>
  )
}

const ENDED_NOTICE: Partial<Record<SessionStatus, { title: string; description: string }>> = {
  CONFIRMED: { title: '이미 만들어진 목표예요', description: '목표 화면에서 확인할 수 있어요.' },
  ABANDONED: { title: '종료된 대화예요', description: '취소했거나 7일이 지나 더 이어갈 수 없어요.' },
}

/**
 * 세션을 불러와서
 *  - 로딩/에러 화면을 대신 보여주고
 *  - 이 화면에서 다룰 수 없는 상태면 맞는 화면으로 보내요 (예: 새로고침했더니 이미 생성 완료)
 */
export function SessionGate({
  sessionId,
  allow,
  children,
}: {
  sessionId: number
  allow: SessionStatus[]
  children: (session: SessionDetail, refetch: () => Promise<unknown>) => ReactNode
}) {
  const router = useRouter()
  const query = useGoalSession(sessionId)
  // 캐시에 남은 옛 데이터로 판단하지 않도록, 이 화면에 들어와서 새로 받은 데이터만 써요.
  // (예: 대화 화면 캐시는 INTERVIEWING 인데 실제론 이미 정리 단계 → 잘못된 화면으로 튕기는 문제 방지)
  const fresh = query.isFetchedAfterMount && !query.isError
  const session = fresh ? query.data : undefined
  const allowed = session ? allow.includes(session.status) : false
  const redirectTo = session && !allowed ? pathForStatus(sessionId, session.status) : null

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo)
  }, [redirectTo, router])

  if (query.isError) {
    return <GateError query={query} />
  }

  if (!session || redirectTo) {
    return (
      <FlowShell>
        <div className="grid flex-1 place-items-center">
          <Spinner className="text-ink-3 size-6" />
        </div>
      </FlowShell>
    )
  }

  if (!allowed) {
    // 여기 오는 건 이어갈 화면이 없는 상태(CONFIRMED / ABANDONED)
    const notice = ENDED_NOTICE[session.status]
    return (
      <FlowShell>
        <CenterMessage title={notice?.title ?? '이어갈 수 없어요'} description={notice?.description}>
          {session.status === 'ABANDONED' ? (
            <Link href={goalFlowPath.start()} className={buttonClass('primary')}>
              새로 시작하기
            </Link>
          ) : (
            <Link href="/goal" className={buttonClass('secondary')}>
              목표로 가기
            </Link>
          )}
        </CenterMessage>
      </FlowShell>
    )
  }

  return <>{children(session, query.refetch)}</>
}

function GateError({ query }: { query: ReturnType<typeof useGoalSession> }) {
  const error = query.error
  const notFound = isApiError(error) && error.httpStatus === 404
  return (
    <FlowShell>
      <CenterMessage
        title={notFound ? '대화를 찾을 수 없어요' : '불러오지 못했어요'}
        description={notFound ? undefined : error?.message}
      >
        {notFound ? (
          <Link href={goalFlowPath.start()} className={buttonClass('primary')}>
            새로 시작하기
          </Link>
        ) : (
          <Button onClick={() => query.refetch()}>다시 시도</Button>
        )}
      </CenterMessage>
    </FlowShell>
  )
}
