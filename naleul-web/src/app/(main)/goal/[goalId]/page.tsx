import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { GoalDetailView } from '@/features/goal/ui/GoalDetailView'

export const metadata: Metadata = { title: '목표' }

/** /goal/12?created=1 — AI 목표를 막 만든 직후 ("이어서 TimeTable 에 배치할까요?" 카드) */
export default async function GoalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ goalId: string }>
  searchParams: Promise<{ created?: string }>
}) {
  const id = Number((await params).goalId)
  if (!Number.isInteger(id) || id <= 0) notFound()
  const { created } = await searchParams
  return <GoalDetailView key={id} goalId={id} justCreated={created === '1'} />
}
