'use client'

import { useState } from 'react'
import { CalendarCheck, Check, NotebookPen, PenLine, RotateCcw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/cn'
import { isApiError } from '@/lib/client/api'
import { toast } from '@/stores/toastStore'
import { useGoalCategories } from '@/features/goal/api'
import { isOngoing } from '@/features/goal/format'
import { formatMonthDay, hm, todayKst } from '@/features/timetable/time'
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
/** 추가한 Task 알림 — 캘린더 옆 패널에서 열었을 때 캘린더를 그 날짜로 옮기고 새 블록을 표시해요 */
export interface TaskAddedInfo {
  taskIds: number[]
  /** 가장 이른 날짜 (시간 미정이면 그날) */
  date: string | null
}

export function TaskAddView({
  initialMode = 'ai',
  variant = 'page',
  onAdded,
}: {
  initialMode?: 'ai' | 'manual' | 'log'
  /** page = /tasks/new 화면 · panel = 캘린더 오른쪽 패널 (좁은 폭, 결과는 옆 캘린더에서 확인) */
  variant?: 'page' | 'panel'
  onAdded?: (info: TaskAddedInfo) => void
}) {
  const panel = variant === 'panel'
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
              // 한 시각에 2개까지는 같이 둘 수 있어요 — 여기 오는 건 이미 2개가 겹친 시간에 3개째를 넣으려 한 경우
              map[c.clientKey] =
                `이 시간엔 이미 ${c.conflictTitle ? `"${c.conflictTitle}"` : '다른 일정 2개'}이(가) 겹쳐 있어요 (${hm(c.start)}–${hm(c.end)}). 시간을 조금 옮겨 주세요.`
            }
            setConflicts(map)
            toast.error('겹치는 일정이 있어서 저장하지 않았어요.')
            return
          }
          setResult(res)
          setStep(2)
          toast.success(`${items.length}개 Task를 추가했어요.`)
          const placedDates = [...res.placements, ...res.movedToOtherDays].map((p) => p.date)
          const allDates = [
            ...placedDates,
            ...res.unscheduled.map((u) => u.date).filter((d): d is string => !!d),
          ].sort()
          onAdded?.({
            taskIds: [
              ...res.placements.map((p) => p.taskId),
              ...res.movedToOtherDays.map((p) => p.taskId),
              ...res.unscheduled.map((u) => u.taskId),
            ],
            date: allDates[0] ?? null,
          })
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

  const wide = panel ? '' : 'max-w-5xl'
  return (
    <>
      {!panel && (
        <PageHeader
          title="Task 추가"
          description="할 일을 AI로 정리하거나 직접 추가하고, 이미 한 일은 기록으로 남길 수 있어요."
        />
      )}

      {/* 추가 방식 고르기 */}
      <div
        className={cn('grid gap-3', panel ? 'grid-cols-3 gap-1.5' : 'mt-5 max-w-5xl sm:grid-cols-3')}
        role="tablist"
        aria-label="추가 방식"
      >
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
                : panel
                  ? desc
                  : undefined
            }
            className={cn(
              'flex rounded-2xl border text-left transition-colors disabled:opacity-40',
              panel ? 'flex-col items-center gap-1 rounded-xl p-2 text-center' : 'items-start gap-3 p-4',
              mode === key ? 'border-ink bg-surface ring-ink ring-1' : 'border-line bg-surface hover:border-line-strong'
            )}
          >
            <span
              className={cn(
                'grid shrink-0 place-items-center rounded-xl',
                panel ? 'size-7 rounded-lg' : 'size-9',
                mode === key ? 'bg-ink text-white' : 'bg-subtle text-ink-3'
              )}
            >
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className={cn('block font-bold', panel ? 'text-[12px]' : 'text-[15px]')}>{title}</span>
              {!panel && <span className="text-ink-3 mt-0.5 block text-[13px] leading-snug">{desc}</span>}
            </span>
          </button>
        ))}
      </div>

      {mode === 'log' ? (
        <div className={cn('mt-4', wide)}>
          <LogDoneView goals={ongoingGoals} />
        </div>
      ) : mode === 'manual' ? (
        <div className={cn('mt-4', wide)}>
          <ManualTaskAdd
            inPanel={panel}
            onCreated={(t) =>
              onAdded?.({
                taskIds: [t.taskId],
                date: (t.plannedStartAt ?? t.date ?? t.scheduledDate ?? '').slice(0, 10) || null,
              })
            }
          />
        </div>
      ) : (
        <>
          <ol className={cn('mb-4 flex flex-wrap items-center gap-2', panel ? 'mt-4' : 'mt-5')} aria-label="진행 단계">
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
                <span className={cn(panel ? 'text-[12px]' : 'text-sm', i === step ? 'font-bold' : 'text-ink-3')}>
                  {panel && i === 2 ? '확인' : label}
                </span>
                {i < STEPS.length - 1 && (
                  <span className={cn('bg-line-strong mx-1 h-px', panel ? 'w-3' : 'w-6')} aria-hidden />
                )}
              </li>
            ))}
          </ol>

          <div className={wide}>
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
            {step === 2 &&
              result &&
              (panel ? (
                <PanelResult result={result} onAddMore={reset} />
              ) : (
                <StepResult result={result} today={today} onAddMore={reset} />
              ))}
          </div>
        </>
      )}
    </>
  )
}

/**
 * 패널에서 저장한 뒤 — 옆 캘린더에 이미 새 블록(NEW)이 보이므로 격자를 또 그리지 않고 어디에 놓였는지만 요약해요.
 * 블록을 옮기거나 고치는 건 캘린더에서 바로 하면 돼요.
 */
function PanelResult({ result, onAddMore }: { result: ConfirmResponse; onAddMore: () => void }) {
  const rows = [
    ...result.placements.map((p) => ({
      id: p.taskId,
      title: p.title,
      when: `${formatMonthDay(p.date)} ${hm(p.start)}–${hm(p.end)}`,
    })),
    ...result.movedToOtherDays.map((p) => ({
      id: p.taskId,
      title: p.title,
      when: `${formatMonthDay(p.date)} ${hm(p.start)}–${hm(p.end)} (다른 날로)`,
    })),
    ...result.unscheduled.map((u) => ({
      id: u.taskId,
      title: u.title,
      when: u.date ? `${formatMonthDay(u.date)} 시간 미정` : '시간 미정',
    })),
  ]
  return (
    <div className="border-line bg-surface rounded-2xl border p-4">
      <p className="flex items-center gap-1.5 text-[15px] font-bold">
        <CalendarCheck className="text-success size-4" />
        {rows.length}개를 추가했어요
      </p>
      <p className="text-ink-3 mt-1 text-[13px]">왼쪽 캘린더에 NEW로 표시돼요. 끌어서 바로 옮길 수 있어요.</p>
      <ul className="mt-3 space-y-1.5">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-2 text-[13px]">
            <Check className="text-success size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate font-medium">{r.title}</span>
            <span className="text-ink-3 shrink-0 tabular-nums">{r.when}</span>
          </li>
        ))}
      </ul>
      <Button variant="secondary" size="sm" className="mt-4" onClick={onAddMore}>
        <RotateCcw className="size-3.5" />더 추가하기
      </Button>
    </div>
  )
}
