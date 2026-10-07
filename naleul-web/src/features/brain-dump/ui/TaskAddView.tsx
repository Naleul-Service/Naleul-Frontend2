'use client'

import { useState } from 'react'
import { Check, NotebookPen, PenLine, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/cn'
import { isApiError } from '@/lib/client/api'
import { toast } from '@/stores/toastStore'
import { useGoalCategories } from '@/features/goal/api'
import { isOngoing } from '@/features/goal/format'
import { hm, todayKst } from '@/features/timetable/time'
import { LogDoneView } from '@/features/record/ui/LogDoneView'
import { useConfirmBrainDump, useParseBrainDump, useTaskQuota } from '../api'
import type { ConfirmResponse, ParseResponse, TempGoalInput } from '../types'
import { ManualTaskAdd } from './ManualTaskAdd'
import { StepGoals, type MapItem } from './StepGoals'
import { StepInput, type DumpLine } from './StepInput'
import { StepResult } from './StepResult'

const STEPS = ['Task 입력', '목표 연결', 'TimeBlock 확인'] as const

/** "15:00:00" → "15:00" */
const toHm = (t?: string | null) => (t ? t.slice(0, 5) : null)

function toMapItems(res: ParseResponse): { items: MapItem[]; tempGoals: TempGoalInput[] } {
  const items: MapItem[] = res.items.map((i) => ({
    clientKey: i.clientKey,
    title: i.title,
    dateType: i.dateType,
    scheduledDate: i.scheduledDate ?? null,
    dueDate: i.dueDate ?? null,
    startTime: toHm(i.startTime),
    endTime: toHm(i.endTime),
    estimatedMinutes: i.estimatedMinutes,
    priority: i.priority ?? 'C',
    kind: i.kind ?? 'NORMAL',
    goalCategoryId: i.goal.type === 'EXISTING' ? (i.goal.goalCategoryId ?? null) : null,
    generalCategoryId: i.goal.type === 'EXISTING' ? (i.goal.generalCategoryId ?? null) : null,
    milestoneId: i.goal.type === 'EXISTING' ? (i.goal.milestoneId ?? null) : null,
    tempGoalKey: i.goal.type === 'TEMP' ? (i.goal.tempKey ?? null) : null,
    reason: i.goal.reason,
  }))
  const used = new Set(items.map((i) => i.tempGoalKey).filter(Boolean))
  const tempGoals = res.tempGoals
    .filter((t) => used.has(t.tempKey))
    .map((t) => ({ tempKey: t.tempKey, name: t.name, emoji: t.emoji ?? null }))
  return { items, tempGoals }
}

/**
 * /tasks/new — Task 추가 3단계 (명세 3-2, 8)
 *   1. Task 입력 (Brain dump) → POST /brain-dump/parse
 *   2. 목표 연결 → POST /brain-dump/confirm
 *   3. TimeBlock 확인
 */
export function TaskAddView({ initialMode = 'ai' }: { initialMode?: 'ai' | 'manual' | 'log' }) {
  const today = todayKst()
  // 목표 만들기처럼 "AI로 정리하기 / 직접 추가하기" 중에서 골라요
  // 할 일을 적거나(ai·manual), 이미 한 일을 기록하거나(log)
  const [mode, setMode] = useState<'ai' | 'manual' | 'log'>(initialMode)
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [lines, setLines] = useState<DumpLine[]>([])
  const [items, setItems] = useState<MapItem[]>([])
  const [tempGoals, setTempGoals] = useState<TempGoalInput[]>([])
  const [aiFailed, setAiFailed] = useState(false)
  const [conflicts, setConflicts] = useState<Record<string, string>>({})
  const [result, setResult] = useState<ConfirmResponse | null>(null)

  const quota = useTaskQuota()
  const goals = useGoalCategories()
  const parse = useParseBrainDump()
  const confirm = useConfirmBrainDump()
  const ongoingGoals = (goals.data ?? []).filter((g) => isOngoing(g.goalCategoryStatus))

  const goParse = () => {
    const valid = lines.filter((l) => l.text.trim())
    if (!valid.length) return
    parse.mutate(
      valid.map((l) => ({
        clientKey: l.clientKey,
        text: l.text.trim(),
        date: l.date,
        dateType: l.date ? l.dateType : null,
        startTime: l.date || l.startTime ? l.startTime : null,
        endTime: l.date || l.startTime ? l.endTime : null,
        estimatedMinutes: l.minutes,
      })),
      {
        onSuccess: (res) => {
          const mapped = toMapItems(res)
          setItems(mapped.items)
          setTempGoals(mapped.tempGoals)
          setAiFailed(res.aiFailed)
          setConflicts({})
          setStep(1)
        },
        onError: (e) => toast.error(isApiError(e) ? e.message : '정리하지 못했어요. 다시 시도해 주세요.'),
      }
    )
  }

  const goConfirm = () => {
    const used = new Set(items.map((i) => i.tempGoalKey).filter(Boolean))
    confirm.mutate(
      {
        // reason 은 화면용이라 보내지 않아요
        items: items.map((i) => ({
          clientKey: i.clientKey,
          title: i.title,
          dateType: i.dateType,
          estimatedMinutes: i.estimatedMinutes,
          priority: i.priority,
          kind: i.kind,
          goalCategoryId: i.goalCategoryId,
          generalCategoryId: i.generalCategoryId,
          milestoneId: i.milestoneId,
          tempGoalKey: i.tempGoalKey,
          scheduledDate: i.dateType === 'ON' ? i.scheduledDate : null,
          dueDate: i.dateType === 'DUE' ? i.dueDate : null,
          startTime: i.dateType === 'ON' ? i.startTime : null,
          endTime: i.dateType === 'ON' && i.startTime ? i.endTime : null,
        })),
        tempGoals: tempGoals.filter((t) => used.has(t.tempKey)).map((t) => ({ ...t, name: t.name.trim() })),
      },
      {
        onSuccess: (res) => {
          if (!res.created) {
            const map: Record<string, string> = {}
            for (const c of res.conflicts) {
              map[c.clientKey] = c.conflictTitle
                ? `"${c.conflictTitle}"과(와) 시간이 겹쳐요 (${hm(c.start)}–${hm(c.end)})`
                : `이번에 입력한 다른 Task와 시간이 겹쳐요 (${hm(c.start)}–${hm(c.end)})`
            }
            setConflicts(map)
            toast.error('겹치는 일정이 있어서 저장하지 않았어요.')
            return
          }
          setResult(res)
          setStep(2)
          toast.success(`${items.length}개 Task를 추가했어요.`)
        },
        onError: (e) => toast.error(isApiError(e) ? e.message : '저장하지 못했어요. 다시 시도해 주세요.'),
      }
    )
  }

  const reset = () => {
    setLines([])
    setItems([])
    setTempGoals([])
    setConflicts({})
    setResult(null)
    setStep(0)
    quota.refetch()
  }

  return (
    <>
      <PageHeader
        title="Task 추가"
        description="할 일을 AI로 정리하거나 직접 추가하고, 이미 한 일은 기록으로 남길 수 있어요."
      />

      {/* 추가 방식 고르기 */}
      <div className="mt-5 grid max-w-5xl gap-3 sm:grid-cols-3" role="tablist" aria-label="추가 방식">
        {(
          [
            ['ai', Sparkles, 'AI로 정리하기', '생각나는 일을 쏟아내면 목표에 연결하고 빈 시간에 배치해요.'],
            ['manual', PenLine, '직접 추가하기', '목표·날짜·시간을 정해서 하나씩 바로 추가해요.'],
            ['log', NotebookPen, '한 일 기록', '이미 한 일을 한 줄씩 적으면 목표에 연결해 기록으로 쌓아요.'],
          ] as const
        ).map(([key, Icon, title, desc]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => setMode(key)}
            disabled={mode === 'ai' && key !== 'ai' && step > 0 && !result}
            title={
              mode === 'ai' && key !== 'ai' && step > 0 && !result
                ? 'AI 정리를 마치거나 처음으로 돌아가면 바꿀 수 있어요'
                : undefined
            }
            className={cn(
              'flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors disabled:opacity-40',
              mode === key ? 'border-ink bg-surface ring-ink ring-1' : 'border-line bg-surface hover:border-line-strong'
            )}
          >
            <span
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-xl',
                mode === key ? 'bg-ink text-white' : 'bg-subtle text-ink-3'
              )}
            >
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-bold">{title}</span>
              <span className="text-ink-3 mt-0.5 block text-[13px] leading-snug">{desc}</span>
            </span>
          </button>
        ))}
      </div>

      {mode === 'log' ? (
        <div className="mt-4 max-w-5xl">
          <LogDoneView goals={ongoingGoals} />
        </div>
      ) : mode === 'manual' ? (
        <div className="mt-4 max-w-5xl">
          <ManualTaskAdd />
        </div>
      ) : (
        <>
          <ol className="mt-5 mb-4 flex flex-wrap items-center gap-2" aria-label="진행 단계">
            {STEPS.map((label, i) => (
              <li key={label} className="flex items-center gap-2" aria-current={step === i ? 'step' : undefined}>
                <span
                  className={cn(
                    'grid size-6 place-items-center rounded-full text-xs font-bold',
                    i < step ? 'bg-success text-white' : i === step ? 'bg-ink text-white' : 'bg-subtle text-ink-3'
                  )}
                >
                  {i < step ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn('text-sm', i === step ? 'font-bold' : 'text-ink-3')}>{label}</span>
                {i < STEPS.length - 1 && <span className="bg-line-strong mx-1 h-px w-6" aria-hidden />}
              </li>
            ))}
          </ol>

          <div className="max-w-5xl">
            {step === 0 && (
              <StepInput
                lines={lines}
                onChange={setLines}
                quota={quota.data}
                quotaLoading={quota.isPending}
                today={today}
                loading={parse.isPending}
                onNext={goParse}
              />
            )}
            {step === 1 && (
              <StepGoals
                items={items}
                tempGoals={tempGoals}
                goals={ongoingGoals}
                aiFailed={aiFailed}
                conflicts={conflicts}
                today={today}
                loading={confirm.isPending}
                onChange={(nextItems, nextTemps) => {
                  setItems(nextItems)
                  setTempGoals(nextTemps)
                  // 고친 Task 는 겹침 표시를 지워요
                  setConflicts((c) => {
                    const changed = nextItems.filter((n) => items.find((o) => o.clientKey === n.clientKey) !== n)
                    if (!changed.length) return c
                    const next = { ...c }
                    changed.forEach((n) => delete next[n.clientKey])
                    return next
                  })
                }}
                onBack={() => setStep(0)}
                onConfirm={goConfirm}
              />
            )}
            {step === 2 && result && <StepResult result={result} today={today} onAddMore={reset} />}
          </div>
        </>
      )}
    </>
  )
}
