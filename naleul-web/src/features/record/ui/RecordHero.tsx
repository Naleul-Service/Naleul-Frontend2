'use client'

import { formatDuration, startOfWeek, todayKst } from '@/features/timetable/time'
import type { ActualActivity } from '@/features/timetable/types'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[120px] flex-1 rounded-2xl bg-white/15 px-4 py-3">
      <p className="text-xs text-white/75">{label}</p>
      <p className="mt-0.5 text-xl font-bold whitespace-nowrap">{value}</p>
    </div>
  )
}

/**
 * 기록형 목표 상단 — 달성률 대신 "얼마나 쌓였는지".
 * 기록형은 목표값·종료일이 없어서 진행률 링이 의미가 없어요.
 */
export function RecordHero({ activities }: { activities: ActualActivity[] }) {
  const today = todayKst()
  const weekStart = startOfWeek(today)
  const thisWeek = activities.filter((a) => a.startAt.slice(0, 10) >= weekStart)
  const todays = activities.filter((a) => a.startAt.slice(0, 10) === today)
  const weekMinutes = thisWeek.reduce((n, a) => n + a.durationMinutes, 0)
  const days = new Set(thisWeek.map((a) => a.startAt.slice(0, 10))).size

  return (
    <section className="bg-ink flex flex-col gap-5 rounded-[24px] p-6 text-white sm:p-8 lg:flex-row lg:items-center">
      <div>
        <p className="text-sm text-white/70">이번 주 쌓인 시간</p>
        <p className="mt-1 text-[40px] leading-none font-bold tracking-tight">
          {weekMinutes ? formatDuration(weekMinutes) : '0분'}
        </p>
      </div>
      <div className="flex flex-1 flex-wrap gap-3 lg:justify-end">
        <Stat label="오늘" value={`${todays.length}개`} />
        <Stat label="이번 주 기록" value={`${thisWeek.length}개`} />
        <Stat label="기록한 날" value={`${days}일`} />
      </div>
    </section>
  )
}
