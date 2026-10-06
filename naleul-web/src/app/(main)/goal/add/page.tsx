import type { Metadata } from 'next'
import { GoalAddView } from '@/features/goal/ui/GoalAddView'

export const metadata: Metadata = { title: '목표 추가' }

/** /goal/add — AI로 설계할지, 직접 만들지 고르기 (?mode=manual 이면 바로 직접 만들기) */
export default async function GoalAddPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams
  return <GoalAddView initialManual={mode === 'manual'} />
}
