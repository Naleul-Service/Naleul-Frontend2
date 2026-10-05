import type { Metadata } from 'next'
import { ComingSoon } from '@/components/layout/ComingSoon'

export const metadata: Metadata = { title: '기본 생활 패턴' }

// FE-5 에서 패턴 목록·추가·수정·삭제와 22시 자동 생성 토글을 만들어요.
export default function LifePatternSettingsPage() {
  return <ComingSoon title="기본 생활 패턴" description="수면·점심·저녁 같은 고정 시간을 바꾸는 화면이에요." />
}
