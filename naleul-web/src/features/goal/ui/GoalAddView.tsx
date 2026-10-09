'use client'

import { useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, BriefcaseBusiness, MessageCircle, PenLine, Sprout, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Chip'
import { cn } from '@/lib/cn'
import { useUserColors } from '@/features/color/api'
import { addDays, todayKst } from '@/features/timetable/time'
import { useCreateGoal } from '../edit/mutations'
import { ColorSwatches, Field, InlineForm, colorIdOf, inlineInput, toNum } from '../edit/inline'
import { isKindComplete, kindBody, type GoalKindValue } from '../kind'
import { RecordGoalForm } from '@/features/record/ui/RecordGoalForm'
import { GoalKindPicker } from './GoalKindPicker'

/** 직접 목표 만들기 폼 — Enter 로 만들기, Esc 로 닫기 */
function ManualGoalForm({ onCancel }: { onCancel: () => void }) {
  const router = useRouter()
  const colors = useUserColors()
  const create = useCreateGoal()
  const today = todayKst()

  const [f, setF] = useState({
    emoji: '',
    name: '',
    start: today,
    end: addDays(today, 90),
    colorId: null as number | null,
    motive: '',
    metricName: '',
    metricUnit: '',
    startValue: '',
    targetValue: '',
  })
  const [showMetric, setShowMetric] = useState(false)
  const [kind, setKind] = useState<GoalKindValue | null>(null)
  const [subs, setSubs] = useState<string[]>([])
  const [subDraft, setSubDraft] = useState('')
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))

  const colorId = f.colorId ?? colorIdOf(colors.data, null)
  const nums = [toNum(f.startValue), toNum(f.targetValue)]
  const error = !f.name.trim()
    ? null
    : !f.start || !f.end
      ? '기간을 입력해 주세요.'
      : f.start > f.end
        ? '종료일이 시작일보다 빨라요.'
        : nums.some((n) => n !== null && Number.isNaN(n))
          ? '수치는 숫자로 입력해 주세요.'
          : !isKindComplete(kind)
            ? '카테고리를 골라 주세요. (기타는 이름 1~10자)'
            : null
  const valid = !!f.name.trim() && !error && colorId !== null

  const addSub = () => {
    const v = subDraft.trim()
    if (!v) return
    if (!subs.includes(v) && subs.length < 10) setSubs([...subs, v.slice(0, 30)])
    setSubDraft('')
  }
  // 세부 목표 칸의 Enter 는 "추가" (비어 있으면 목표 만들기로 넘어가요)
  const onSubKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
    if (subDraft.trim()) {
      e.preventDefault()
      addSub()
    }
  }

  const submit = () =>
    create.mutate(
      {
        goalCategoryName: f.name.trim(),
        goalCategoryStartDate: f.start,
        goalCategoryEndDate: f.end,
        colorId: colorId!,
        motive: f.motive.trim() || undefined,
        emoji: f.emoji.trim() || undefined,
        ...kindBody(kind),
        ...(showMetric && f.metricName.trim()
          ? {
              metricName: f.metricName.trim(),
              metricUnit: f.metricUnit.trim(),
              startValue: nums[0],
              targetValue: nums[1],
            }
          : {}),
        // 입력칸에 적어 두고 추가를 안 누른 것도 넣어요
        subGoals: [...subs, ...(subDraft.trim() && !subs.includes(subDraft.trim()) ? [subDraft.trim()] : [])],
      },
      { onSuccess: ({ goal }) => router.push(`/goal/${goal.goalCategoryId}`) }
    )

  return (
    <InlineForm
      onSubmit={submit}
      onCancel={onCancel}
      saving={create.isPending}
      valid={valid}
      error={error}
      submitLabel="목표 만들기"
      className="mt-4"
    >
      <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-2">
        <Field label="이모지">
          <input
            value={f.emoji}
            onChange={(e) => set('emoji', e.target.value)}
            maxLength={16}
            placeholder="🎯"
            className={`${inlineInput} text-center placeholder:opacity-40`}
          />
        </Field>
        <Field label="목표 이름">
          <input
            value={f.name}
            onChange={(e) => set('name', e.target.value)}
            maxLength={50}
            placeholder="예: 토익 900점 달성"
            className={inlineInput}
            data-autofocus
          />
        </Field>
      </div>
      <div>
        <span className="text-ink-3 mb-1 block text-[12px] font-medium">카테고리</span>
        <GoalKindPicker value={kind} onChange={setKind} compact />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="시작일">
          <input type="date" value={f.start} onChange={(e) => set('start', e.target.value)} className={inlineInput} />
        </Field>
        <Field label="종료일">
          <input type="date" value={f.end} onChange={(e) => set('end', e.target.value)} className={inlineInput} />
        </Field>
      </div>
      <Field label="색상">
        <ColorSwatches colors={colors.data} value={colorId} onChange={(id) => set('colorId', id)} />
      </Field>
      <Field label="이 목표를 시작한 이유 (선택)">
        <textarea
          value={f.motive}
          onChange={(e) => set('motive', e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Shift+Enter 로 줄바꿈"
          className={`${inlineInput} h-auto resize-none py-2 leading-relaxed`}
        />
      </Field>

      {/* 세부 목표: Enter 로 하나씩 */}
      <div>
        <span className="text-ink-3 mb-1 block text-[12px] font-medium">세부 목표 (선택 · Enter로 추가)</span>
        <div className="border-line-strong bg-surface focus-within:border-ink-3 flex flex-wrap items-center gap-1.5 rounded-xl border px-2 py-1.5">
          {subs.map((s) => (
            <span
              key={s}
              className="bg-brand-soft text-brand inline-flex h-7 items-center gap-1 rounded-full pr-1 pl-2.5 text-[13px] font-semibold"
            >
              {s}
              <button
                type="button"
                onClick={() => setSubs(subs.filter((x) => x !== s))}
                aria-label={`${s} 빼기`}
                className="hover:bg-brand/10 rounded-full p-0.5"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <input
            value={subDraft}
            onChange={(e) => setSubDraft(e.target.value)}
            onKeyDown={onSubKey}
            maxLength={30}
            placeholder={subs.length ? '' : '예: LC 연습, 단어 외우기'}
            aria-label="세부 목표 추가"
            className="placeholder:text-ink-4 h-7 min-w-[140px] flex-1 bg-transparent text-[14px] outline-none"
          />
        </div>
      </div>

      {showMetric ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label="수치 이름">
            <input
              value={f.metricName}
              onChange={(e) => set('metricName', e.target.value)}
              maxLength={30}
              placeholder="체중"
              className={inlineInput}
            />
          </Field>
          <Field label="단위">
            <input
              value={f.metricUnit}
              onChange={(e) => set('metricUnit', e.target.value)}
              maxLength={10}
              placeholder="kg"
              className={inlineInput}
            />
          </Field>
          <Field label="시작">
            <input
              inputMode="decimal"
              value={f.startValue}
              onChange={(e) => set('startValue', e.target.value)}
              placeholder="80"
              className={inlineInput}
            />
          </Field>
          <Field label="목표">
            <input
              inputMode="decimal"
              value={f.targetValue}
              onChange={(e) => set('targetValue', e.target.value)}
              placeholder="72"
              className={inlineInput}
            />
          </Field>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowMetric(true)}
          className="text-brand self-start text-[13px] font-semibold"
        >
          + 수치 목표 추가 (예: 체중 80 → 72kg)
        </button>
      )}
      <p className="text-ink-3 text-xs">만든 뒤 목표 상세에서 루틴·마일스톤·Task를 바로 추가할 수 있어요.</p>
    </InlineForm>
  )
}

const WORK_EXAMPLES = ['OO팀 업무', '신규 서비스 기획', '포트폴리오 앱 만들기', '블로그 운영']
const LIFE_EXAMPLES = ['주 3회 운동하기', '3개월에 5kg 감량', '토익 900점', '매일 6시 30분 기상', '한 달에 책 2권']

function Examples({ items }: { items: string[] }) {
  return (
    <div className="mt-4">
      <p className="text-ink-3 mb-1.5 text-[12px] font-medium">이런 목표를 만들 수 있어요</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((x) => (
          <span key={x} className="bg-subtle text-ink-2 rounded-full px-2.5 py-1 text-[12px]">
            {x}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * /goal/add — 목적에 따라 두 가지
 *  - 업무형: 회사 업무 · 사이드 프로젝트. 기한·수치 없이 만들고 완료한 Task 로 업무 일지·패턴을 쌓아요 (goal_mode = RECORD)
 *  - 생활형: 건강 · 학습 · 생활습관. AI 가 대화로 기간·루틴까지 설계 (/goal/new), 계획이 있으면 직접 입력
 */
export function GoalAddView({ initialMode = null }: { initialMode?: 'manual' | 'record' | null }) {
  const [open, setOpen] = useState<'manual' | 'record' | null>(initialMode)
  const card = 'border-line bg-surface flex flex-col rounded-[20px] border p-5 text-left transition-colors sm:p-6'

  return (
    <>
      <PageHeader
        breadcrumb={<Link href="/goal">목표</Link>}
        title="목표 추가"
        description="어떤 일을 위한 목표인가요?"
      />

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {/* 업무형 */}
        <section className={cn(card, open === 'record' && 'border-ink ring-ink ring-1')} aria-labelledby="work-title">
          <span className="bg-ink grid size-11 place-items-center rounded-2xl text-white">
            <BriefcaseBusiness className="size-5" />
          </span>
          <p id="work-title" className="mt-4 flex flex-wrap items-center gap-2 text-[18px] font-bold">
            업무형 <Badge tone="neutral">회사 업무 · 사이드 프로젝트</Badge>
          </p>
          <p className="text-ink-3 mt-1.5 text-sm leading-relaxed">
            마감이나 수치보다 꾸준히 해 나가는 일이에요. Task를 완료할 때마다 업무 일지와 나의 패턴이 쌓여요.
          </p>
          <Examples items={WORK_EXAMPLES} />
          <div className="mt-auto pt-5">
            <button
              type="button"
              onClick={() => setOpen('record')}
              aria-expanded={open === 'record'}
              className="text-ink group flex items-center gap-1 text-sm font-semibold"
            >
              {open === 'record' ? '아래에서 정해 주세요' : '업무 목표 만들기'}
              <ArrowRight
                className={cn(
                  'size-4 transition-transform',
                  open === 'record' ? 'rotate-90' : 'group-hover:translate-x-0.5'
                )}
              />
            </button>
          </div>
        </section>

        {/* 생활형 */}
        <section className={cn(card, open === 'manual' && 'border-ink ring-ink ring-1')} aria-labelledby="life-title">
          <span className="bg-brand-soft text-brand grid size-11 place-items-center rounded-2xl">
            <Sprout className="size-5" />
          </span>
          <p id="life-title" className="mt-4 flex flex-wrap items-center gap-2 text-[18px] font-bold">
            생활형 <Badge tone="brand">건강 · 학습 · 생활습관</Badge>
          </p>
          <p className="text-ink-3 mt-1.5 text-sm leading-relaxed">
            이루고 싶은 모습이 분명한 목표예요. AI가 몇 가지 질문을 한 뒤 기간과 꼭 필요한 루틴까지 계획해 드려요.
          </p>
          <Examples items={LIFE_EXAMPLES} />
          <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 pt-5">
            <Link href="/goal/new" className="text-brand group flex items-center gap-1 text-sm font-semibold">
              <MessageCircle className="size-4" />
              AI와 대화 시작하기
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <button
              type="button"
              onClick={() => setOpen('manual')}
              aria-expanded={open === 'manual'}
              className="text-ink-3 hover:text-ink-2 flex items-center gap-1 text-[13px] font-medium"
            >
              <PenLine className="size-3.5" />
              {open === 'manual' ? '아래에서 입력해 주세요' : '계획이 있다면 직접 입력하기'}
            </button>
          </div>
        </section>
      </div>

      {open === 'record' && <RecordGoalForm onCancel={() => setOpen(null)} className="mt-4 max-w-2xl" />}
      {open === 'manual' && <ManualGoalForm onCancel={() => setOpen(null)} />}
    </>
  )
}
