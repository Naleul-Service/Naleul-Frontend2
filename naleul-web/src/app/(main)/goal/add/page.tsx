import type { Metadata } from 'next'
import { GoalAddView } from '@/features/goal/ui/GoalAddView'

export const metadata: Metadata = { title: '목표 추가' }

/** /goal/add — AI로 설계 / 기록형 / 직접 만들기 중 고르기 (?mode=manual · ?mode=record 이면 그 폼을 바로 열어요) */
export default async function GoalAddPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams
  return <GoalAddView initialMode={mode === 'manual' || mode === 'record' ? mode : null} />
}
