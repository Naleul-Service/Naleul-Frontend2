import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { BarChart3, Bell, ChevronRight, Clock, FileText, type LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { LogoutButton } from '@/features/account/ui/LogoutButton'
import { ProfileSummaryCard } from '@/features/account/ui/ProfileSummaryCard'
import { ThemePicker } from '@/features/theme/ThemePicker'
import { UsageCard } from '@/features/usage/ui/UsageCard'
import { COOKIE, type UserRole } from '@/lib/server/session'

export const metadata: Metadata = { title: '설정' }

const ITEMS: { href: string; icon: LucideIcon; title: string; description: string }[] = [
  {
    href: '/settings/life-pattern',
    icon: Clock,
    title: '기본 생활 패턴',
    description: '수면·점심·저녁·이동시간처럼 매주 반복되는 고정 시간',
  },
  {
    href: '/settings/notifications',
    icon: Bell,
    title: '알림 설정',
    description: 'Task·미션 푸시 알림을 종류별로 켜고 꺼요 (나를 앱에 적용)',
  },
  {
    href: '/settings/terms',
    icon: FileText,
    title: '약관 동의',
    description: '서비스 이용약관 · 개인정보 수집 및 이용 · 마케팅 정보 수신',
  },
]

const rowClass =
  'hover:bg-subtle/60 first:rounded-t-card last:rounded-b-card flex w-full items-center gap-3 px-5 py-4 text-left'

export default async function SettingsPage() {
  const store = await cookies()
  const user = {
    name: store.get(COOKIE.userName)?.value || '나를 사용자',
    role: store.get(COOKIE.userRole)?.value as UserRole | undefined,
  }

  return (
    <>
      <PageHeader title="설정" />

      <div className="mt-6 max-w-3xl space-y-6">
        <ProfileSummaryCard user={user} />

        <Card className="divide-line divide-y">
          {ITEMS.map(({ href, icon: Icon, title, description }) => (
            <Link key={href} href={href} className={rowClass}>
              <span className="bg-brand-soft text-brand grid size-10 shrink-0 place-items-center rounded-xl">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold">{title}</p>
                <p className="text-ink-3 mt-0.5 text-[13px]">{description}</p>
              </div>
              <ChevronRight className="text-ink-4 size-4" />
            </Link>
          ))}
        </Card>

        <Card>
          <ThemePicker />
        </Card>

        {/* ⚠️ DEV 전용 — 운영 대시보드 버튼. main 에 머지할 때 이 블록을 주석 처리해요 (시작) */}
        <Card>
          <Link href="/settings/dashboard" className={rowClass}>
            <span className="bg-warning-soft grid size-10 shrink-0 place-items-center rounded-xl text-warning-ink">
              <BarChart3 className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold">
                운영 대시보드 <span className="text-ink-3 ml-1 text-[11px] font-semibold">DEV</span>
              </p>
              <p className="text-ink-3 mt-0.5 text-[13px]">목표 달성률 · Task/루틴 실천률 · AI 비용 · 매출 · 서버 비용</p>
            </div>
            <ChevronRight className="text-ink-4 size-4" />
          </Link>
        </Card>
        {/* ⚠️ DEV 전용 — 운영 대시보드 버튼 (끝) */}

        {/* 하루 횟수가 정해진 기능 (AI 목표 만들기 · AI 계획 초안 · Task 추가) */}
        <UsageCard />

        <Card className="divide-line divide-y">
          <LogoutButton className={rowClass} />
          <Link href="/settings/withdraw" className={rowClass}>
            <span className="text-danger flex-1 text-[15px] font-semibold">탈퇴하기</span>
          </Link>
        </Card>
      </div>
    </>
  )
}
