'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarDays, Check, Smartphone } from 'lucide-react'
import { Button, buttonClass } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { inputClass } from '@/features/goal-creation/ui/formParts'
import { useGoalCategories } from '@/features/goal/api'
import { isOngoing } from '@/features/goal/format'
import { useImportExternalEvents } from '../api'
import {
  googleClientId,
  listGoogleCalendars,
  listGoogleEvents,
  requestGoogleToken,
  type GoogleCalendar,
} from '../google'
import type { ExternalEvent, ImportResult } from '../types'

type Source = 'GOOGLE' | 'NOTION' | 'APPLE'

const SOURCES: { value: Source; label: string; hint: string; mark: string }[] = [
  { value: 'GOOGLE', label: '구글 캘린더', hint: '구글 계정을 연결해서 가져와요', mark: 'G' },
  { value: 'NOTION', label: '노션 캘린더', hint: '노션 캘린더에 연결한 계정에서 가져와요', mark: 'N' },
  { value: 'APPLE', label: '아이폰 기본 캘린더', hint: '나를 iOS 앱에서 가져와요', mark: '' },
]

// ─── 날짜 ───────────────────────────────────────────────────────
const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const todayKst = () => new Date(Date.now() + KST_OFFSET_MS).toISOString().slice(0, 10)
const addDays = (ymd: string, n: number) =>
  new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']
const dayLabel = (ymd: string) => {
  const d = new Date(`${ymd}T00:00:00Z`)
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAY[d.getUTCDay()]})`
}
const hm = (iso: string | null) => (iso ? iso.slice(11, 16) : '')

/** 설정 > 외부 캘린더 가져오기 */
export function CalendarImportView() {
  const [source, setSource] = useState<Source | null>(null)

  return (
    <div className="mt-6 max-w-3xl space-y-6">
      <Card className="p-5 sm:p-6">
        <p className="text-[15px] font-bold">어디서 가져올까요?</p>
        <p className="text-ink-3 mt-1 text-[13px]">
          고른 일정은 나를의 Task가 돼요. 한 번 가져온 뒤에는 원래 캘린더에서 바꿔도 다시 반영되지 않아요.
        </p>
        <div role="radiogroup" aria-label="가져올 캘린더" className="mt-4 grid gap-3 sm:grid-cols-3">
          {SOURCES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={source === s.value}
              onClick={() => setSource(s.value)}
              className={cn(
                'flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors',
                source === s.value ? 'border-brand bg-brand-soft' : 'border-line-strong hover:border-ink-4',
              )}
            >
              <span className="bg-subtle text-ink grid size-9 place-items-center rounded-xl text-[15px] font-bold">
                {s.value === 'APPLE' ? <Smartphone className="size-4" /> : s.mark}
              </span>
              <span className="text-[15px] font-bold">{s.label}</span>
              <span className="text-ink-3 text-[12px] leading-snug">{s.hint}</span>
            </button>
          ))}
        </div>
      </Card>

      {source === 'NOTION' && <NotionGuide onGoogle={() => setSource('GOOGLE')} />}
      {source === 'APPLE' && <AppleGuide />}
      {source === 'GOOGLE' && <GoogleImport />}
    </div>
  )
}

/** 노션 캘린더는 자체 저장소 · 공개 API 가 없어요 → 연결한 계정(구글 · iCloud)에서 가져오게 안내 */
function NotionGuide({ onGoogle }: { onGoogle: () => void }) {
  return (
    <Card className="p-5 sm:p-6">
      <p className="text-[15px] font-bold">노션 캘린더 일정은 연결한 계정에 저장돼 있어요</p>
      <p className="text-ink-2 mt-2 text-[14px] leading-relaxed">
        노션 캘린더는 구글 · iCloud · Outlook 캘린더를 모아서 보여주는 앱이라, 일정은 그 계정에 들어 있어요. 노션
        캘린더에 연결한 계정으로 가져오면 같은 일정을 그대로 받을 수 있어요.
      </p>
      <ul className="text-ink-2 mt-3 space-y-1.5 text-[14px]">
        <li>· 구글 계정 → 아래 버튼으로 바로 가져와요</li>
        <li>· iCloud · Outlook 계정 → 나를 iOS 앱의 &ldquo;아이폰 기본 캘린더&rdquo;로 가져와요</li>
      </ul>
      <Button variant="brand" className="mt-4" onClick={onGoogle}>
        구글 캘린더로 가져오기
        <ArrowRight className="size-4" />
      </Button>
    </Card>
  )
}

function AppleGuide() {
  return (
    <Card className="p-5 sm:p-6">
      <p className="text-[15px] font-bold">아이폰 기본 캘린더는 나를 iOS 앱에서 가져와요</p>
      <p className="text-ink-2 mt-2 text-[14px] leading-relaxed">
        아이폰 캘린더는 기기 안에서만 읽을 수 있어서 웹에서는 가져올 수 없어요. 나를 앱의{' '}
        <b>설정 → 외부 캘린더 가져오기</b>에서 캘린더를 고르면, 가져온 Task가 여기 웹에도 그대로 보여요.
      </p>
      <p className="text-ink-3 mt-2 text-[13px]">
        아이폰에 추가한 iCloud · 구글 · Outlook 계정 일정과 노션 캘린더 일정도 함께 가져올 수 있어요.
      </p>
    </Card>
  )
}

// ─── 구글 ───────────────────────────────────────────────────────

function GoogleImport() {
  const today = todayKst()
  const [token, setToken] = useState<string | null>(null)
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([])
  const [calIds, setCalIds] = useState<Set<string>>(new Set())
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(addDays(today, 27))
  const [goalId, setGoalId] = useState<number | null>(null)
  const [events, setEvents] = useState<ExternalEvent[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<'connect' | 'load' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const goals = useGoalCategories()
  const importer = useImportExternalEvents()

  const ongoingGoals = (goals.data ?? []).filter((g) => !g.temporary && isOngoing(g.goalCategoryStatus))

  const connect = async () => {
    setBusy('connect')
    setError(null)
    try {
      const t = await requestGoogleToken()
      const cals = await listGoogleCalendars(t)
      setToken(t)
      setCalendars(cals)
      setCalIds(new Set(cals.filter((c) => c.primary).map((c) => c.id)))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const load = async () => {
    if (!token) return
    setBusy('load')
    setError(null)
    setResult(null)
    try {
      const chosen = calendars.filter((c) => calIds.has(c.id))
      const lists = await Promise.all(chosen.map((c) => listGoogleEvents(token, c, from, to)))
      const all = lists
        .flat()
        .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.start ?? '').localeCompare(b.start ?? ''))
      setEvents(all)
      // 하루 종일 일정(생일 · 휴가 등)은 할 일이 아닌 경우가 많아서 처음엔 빼 둬요
      setPicked(new Set(all.filter((e) => !e.allDay).map((e) => e.externalId)))
    } catch (e) {
      setError((e as Error).message)
      if ((e as Error).message.includes('만료')) setToken(null)
    } finally {
      setBusy(null)
    }
  }

  const run = () => {
    if (!events) return
    importer.mutate(
      { source: 'GOOGLE', goalCategoryId: goalId, events: events.filter((e) => picked.has(e.externalId)) },
      {
        onSuccess: (r) => {
          setResult(r)
          setEvents(null)
        },
        onError: (e) => setError(e.message),
      },
    )
  }

  if (!googleClientId) {
    return (
      <Card className="p-5 sm:p-6">
        <p className="text-[15px] font-bold">구글 연동 준비 중이에요</p>
        <p className="text-ink-3 mt-1 text-[13px]">관리자: .env 에 NEXT_PUBLIC_GOOGLE_CLIENT_ID 를 넣어 주세요.</p>
      </Card>
    )
  }

  return (
    <>
      <Card className="p-5 sm:p-6">
        {!token ? (
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold">구글 계정 연결</p>
              <p className="text-ink-3 mt-1 text-[13px]">
                캘린더 읽기 권한만 받아요. 나를은 구글 일정을 바꾸거나 지우지 않고, 연결 정보도 저장하지 않아요.
              </p>
            </div>
            <Button variant="primary" onClick={connect} loading={busy === 'connect'}>
              구글 계정 연결하기
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-[15px] font-bold">가져올 캘린더</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {calendars.map((c) => {
                  const on = calIds.has(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        const next = new Set(calIds)
                        if (on) next.delete(c.id)
                        else next.add(c.id)
                        setCalIds(next)
                      }}
                      className={cn(
                        'flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors',
                        on ? 'border-ink bg-subtle text-ink' : 'border-line-strong text-ink-3 hover:text-ink',
                      )}
                    >
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                      {on && <Check className="size-3.5" />}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="text-ink-3 text-[13px] font-semibold">시작일</span>
                <input
                  type="date"
                  className={cn(inputClass, 'mt-1.5')}
                  value={from}
                  min={today}
                  max={to}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-ink-3 text-[13px] font-semibold">종료일</span>
                <input
                  type="date"
                  className={cn(inputClass, 'mt-1.5')}
                  value={to}
                  min={from}
                  max={addDays(today, 365)}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-ink-3 text-[13px] font-semibold">연결할 목표 (선택)</span>
                <select
                  className={cn(inputClass, 'mt-1.5')}
                  value={goalId ?? ''}
                  onChange={(e) => setGoalId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">목표 없이</option>
                  {ongoingGoals.map((g) => (
                    <option key={g.goalCategoryId} value={g.goalCategoryId}>
                      {g.emoji ? `${g.emoji} ` : ''}
                      {g.goalCategoryName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-ink-3 -mt-2 text-[12px]">
              지난 일정은 &ldquo;못 한 일&rdquo;로 잡혀 실행률이 틀어져서 오늘부터 가져와요.
            </p>

            <Button variant="brand" onClick={load} loading={busy === 'load'} disabled={!calIds.size}>
              <CalendarDays className="size-4" />
              일정 불러오기
            </Button>
          </div>
        )}
        {error && <p className="text-danger mt-3 text-[13px] font-medium">{error}</p>}
      </Card>

      {events && (
        <EventPicker
          events={events}
          picked={picked}
          setPicked={setPicked}
          onImport={run}
          importing={importer.isPending}
        />
      )}

      {result && <ResultCard r={result} />}
    </>
  )
}

function EventPicker({
  events,
  picked,
  setPicked,
  onImport,
  importing,
}: {
  events: ExternalEvent[]
  picked: Set<string>
  setPicked: (s: Set<string>) => void
  onImport: () => void
  importing: boolean
}) {
  const byDate = useMemo(() => {
    const m = new Map<string, ExternalEvent[]>()
    for (const e of events) {
      const k = e.date ?? ''
      m.set(k, [...(m.get(k) ?? []), e])
    }
    return [...m.entries()]
  }, [events])

  const allPicked = events.length > 0 && events.every((e) => picked.has(e.externalId))
  const toggle = (id: string) => {
    const next = new Set(picked)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setPicked(next)
  }

  if (!events.length) {
    return <Card className="text-ink-3 p-8 text-center text-sm">이 기간에 가져올 일정이 없어요.</Card>
  }

  return (
    <Card>
      <div className="border-line flex flex-wrap items-center gap-3 border-b px-5 py-4">
        <p className="flex-1 text-[15px] font-bold">
          일정 {events.length}개 <span className="text-ink-3 ml-1 text-[13px] font-semibold">{picked.size}개 선택</span>
        </p>
        <button
          type="button"
          className="text-ink-2 hover:text-ink text-[13px] font-semibold"
          onClick={() => setPicked(allPicked ? new Set() : new Set(events.map((e) => e.externalId)))}
        >
          {allPicked ? '모두 해제' : '모두 선택'}
        </button>
      </div>
      <div className="max-h-[480px] overflow-y-auto px-5 py-2">
        {byDate.map(([date, list]) => (
          <section key={date} className="py-2">
            <h3 className="text-ink-3 py-1.5 text-[12px] font-bold">{date ? dayLabel(date) : '날짜 없음'}</h3>
            <ul>
              {list.map((e) => {
                const on = picked.has(e.externalId)
                return (
                  <li key={e.externalId}>
                    <label className="hover:bg-subtle/60 -mx-2 flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2">
                      <input
                        type="checkbox"
                        className="accent-brand size-4 shrink-0"
                        checked={on}
                        onChange={() => toggle(e.externalId)}
                      />
                      <span className="text-ink-3 w-[92px] shrink-0 text-[13px] tabular-nums">
                        {e.allDay ? '하루 종일' : `${hm(e.start)}–${hm(e.end)}`}
                      </span>
                      <span className={cn('min-w-0 flex-1 truncate text-[14px]', !on && 'text-ink-3')}>{e.title}</span>
                      {e.calendarName && (
                        <span className="text-ink-4 hidden shrink-0 text-[12px] sm:inline">{e.calendarName}</span>
                      )}
                    </label>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
      <div className="border-line flex flex-wrap items-center gap-3 border-t px-5 py-4">
        <p className="text-ink-3 flex-1 text-[12px]">
          하루 종일 일정은 처음엔 빼 뒀어요. 시간 일정은 그 시각에, 하루 종일 일정은 그날의 &ldquo;시간 미정&rdquo;에
          들어가요.
        </p>
        <Button variant="primary" onClick={onImport} loading={importing} disabled={!picked.size}>
          {picked.size}개 Task로 가져오기
        </Button>
      </div>
    </Card>
  )
}

function ResultCard({ r }: { r: ImportResult }) {
  const skipped = [
    r.skippedDuplicate && `이미 있는 일정 ${r.skippedDuplicate}개`,
    r.skippedPast && `지난 일정 ${r.skippedPast}개`,
    r.skippedInvalid && `시간 정보가 맞지 않는 일정 ${r.skippedInvalid}개`,
  ].filter(Boolean)
  return (
    <Card className="p-5 sm:p-6">
      <p className="text-[17px] font-bold">
        {r.created ? `${r.created}개를 Task로 만들었어요` : '새로 만든 Task가 없어요'}
      </p>
      {skipped.length > 0 && <p className="text-ink-3 mt-1 text-[13px]">건너뜀: {skipped.join(' · ')}</p>}
      <Link href="/calendar" className={cn(buttonClass('secondary'), 'mt-4')}>
        캘린더에서 보기
        <ArrowRight className="size-4" />
      </Link>
    </Card>
  )
}
