import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { GoalDetailView } from '@/features/goal/ui/GoalDetailView'

export const metadata: Metadata = { title: '목표' }

export default async function GoalDetailPage({ params }: { params: Promise<{ goalId: string }> }) {
  const id = Number((await params).goalId)
  if (!Number.isInteger(id) || id <= 0) notFound()
  return <GoalDetailView goalId={id} />
}
