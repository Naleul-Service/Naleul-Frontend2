import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Clock } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { UsageCard } from '@/features/usage/ui/UsageCard'

export const metadata: Metadata = { title: '설정' }

const ITEMS = [
  {
    href: '/settings/life-pattern',
    icon: Clock,
    title: '기본 생활 패턴',
    description: '수면·점심·저녁·이동시간처럼 매주 반복되는 고정 시간',
  },
]

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="설정" />
      <Card className="divide-line mt-6 divide-y">
        {ITEMS.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="hover:bg-subtle/60 first:rounded-t-card last:rounded-b-card flex items-center gap-3 px-5 py-4"
          >
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
      {/* 하루 횟수가 정해진 기능 (AI 목표 만들기 · AI 계획 초안 · Task 추가) */}
      <div className="mt-6">
        <UsageCard />
      </div>
    </>
  )
}
