import type { Metadata } from 'next'
import { ComingSoon } from '@/components/layout/ComingSoon'

export const metadata: Metadata = { title: '홈' }

export default function HomePage() {
  return <ComingSoon title="홈" />
}
