'use client'

import { useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, MessageCircle, PenLine, Sparkles, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Chip'
import { cn } from '@/lib/cn'
import { useUserColors } from '@/features/color/api'
import { addDays, todayKst } from '@/features/timetable/time'
import { useCreateGoal } from '../edit/mutations'
import { ColorSwatches, Field, InlineForm, colorIdOf, inlineInput, toNum } from '../edit/inline'

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

/**
 * /goal/add — 목표 추가 방법 고르기
 *  - AI로 설계: 대화로 기간·마일스톤·루틴까지 (기존 /goal/new)
 *  - 직접 만들기: 이 화면에서 바로 입력
 */
export function GoalAddView({ initialManual = false }: { initialManual?: boolean }) {
  const [manual, setManual] = useState(initialManual)
  const card =
    'border-line bg-surface hover:border-line-strong group flex flex-col rounded-[20px] border p-5 text-left transition-colors sm:p-6'

  return (
    <>
      <PageHeader breadcrumb={<Link href="/goal">목표</Link>} title="목표 추가" description="어떻게 만들어 볼까요?" />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link href="/goal/new" className={card}>
          <span className="bg-brand-soft text-brand grid size-11 place-items-center rounded-2xl">
            <Sparkles className="size-5" />
          </span>
          <p className="mt-4 flex items-center gap-2 text-[17px] font-bold">
            AI로 설계하기 <Badge tone="brand">추천</Badge>
          </p>
          <p className="text-ink-3 mt-1.5 text-sm leading-relaxed">
            한 문장만 말하면 몇 가지 질문을 하고, 세부 목표·마일스톤·루틴까지 계획을 짜 드려요.
          </p>
          <span className="text-brand mt-4 flex items-center gap-1 text-sm font-semibold">
            <MessageCircle className="size-4" />
            대화 시작하기
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setManual(true)}
          aria-expanded={manual}
          className={cn(card, manual && 'border-ink ring-ink ring-1')}
        >
          <span className="bg-subtle text-ink-2 grid size-11 place-items-center rounded-2xl">
            <PenLine className="size-5" />
          </span>
          <p className="mt-4 text-[17px] font-bold">직접 만들기</p>
          <p className="text-ink-3 mt-1.5 text-sm leading-relaxed">
            이미 계획이 있다면 이름·기간·세부 목표를 직접 정해요. 나중에 AI로 구체화할 수도 있어요.
          </p>
          <span className="text-ink-2 mt-4 flex items-center gap-1 text-sm font-semibold">
            {manual ? '아래에서 입력해 주세요' : '바로 입력하기'}
            <ArrowRight
              className={cn('size-4 transition-transform', manual ? 'rotate-90' : 'group-hover:translate-x-0.5')}
            />
          </span>
        </button>
      </div>

      {manual && <ManualGoalForm onCancel={() => setManual(false)} />}
    </>
  )
}
