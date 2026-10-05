import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { GeneratingScreen } from '@/features/goal-creation/ui/generating/GeneratingScreen'
import { parseSessionId } from '@/features/goal-creation/parseSessionId'

export const metadata: Metadata = { title: '계획 만드는 중' }

export default async function GeneratingPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>
  searchParams: Promise<{ draftId?: string }>
}) {
  const id = parseSessionId((await params).sessionId)
  if (!id) notFound()
  const draftId = parseSessionId((await searchParams).draftId)
  return <GeneratingScreen sessionId={id} draftId={draftId} />
}
