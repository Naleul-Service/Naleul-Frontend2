'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Chip'
import { cn } from '@/lib/cn'
import { isApiError } from '@/lib/client/api'
import { toast } from '@/stores/toastStore'
import { goalCreationApi, goalCreationKeys } from '../../api'
import { PLANNING_STYLE_LABEL } from '../../constants'
import { markStyleSelectedByUser, wasStyleSelectedByUser } from '../../planningStyleMemory'
import { goalFlowPath } from '../../routes'
import type { PlanningStyle, SessionDetail, SlotKey, SlotsPatch } from '../../types'
import { MustDoPicker } from '../MustDoPicker'
import { FlowShell } from '../SessionGate'
import { SlotEditModal } from './SlotEditModal'

const STYLE_DESCRIPTION: Record<PlanningStyle, string> = {
  PLANNER: '요일·시간을 정해 매일 조금씩',
  SPONTANEOUS: '여유 있게, 몰아서 해도 괜찮게',
}

function SummaryRow({ label, value, onClick }: { label: string; value: string | null; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-canvas group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors"
    >
      <span className="text-ink-3 w-16 shrink-0 text-[13px]">{label}</span>
      <span className={cn('min-w-0 flex-1 text-[15px] leading-relaxed', value ? 'font-semibold' : 'text-ink-4')}>
        {value ?? 'AI가 알맞게 정해줄게요'}
      </span>
      <ChevronRight className="text-ink-4 group-hover:text-ink-2 size-4 shrink-0" />
    </button>
  )
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-bold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

/** G-2 정리 확인 */
export function ReviewView({ session }: { session: SessionDetail }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const sessionId = session.sessionId
  const summary = session.summary

  const [editing, setEditing] = useState<SlotKey | null>(null)
  // 꼭 할 일 수정 (슬롯이 아니라 따로 저장돼요)
  const [mustDoOpen, setMustDoOpen] = useState(false)
  const [mustDoDraft, setMustDoDraft] = useState<string[]>(session.mustDoItems ?? [])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const aiStyle: PlanningStyle = summary?.planningStyle ?? 'PLANNER'
  const [style, setStyle] = useState<PlanningStyle>(aiStyle)
  const [styleByUser, setStyleByUser] = useState(() => wasStyleSelectedByUser(sessionId))
  const [generating, setGenerating] = useState(false)

  const openEdit = (slot: SlotKey) => {
    setSaveError(null)
    setEditing(slot)
  }

  const save = async (patch: SlotsPatch) => {
    setSaving(true)
    setSaveError(null)
    try {
      const turn = await goalCreationApi.updateSlots(sessionId, patch)
      // 화면 데이터(캐시)를 응답으로 바로 갱신 → 다시 불러오지 않아도 요약이 바뀌어요
      queryClient.setQueryData<SessionDetail>(goalCreationKeys.session(sessionId), (prev) =>
        prev
          ? { ...prev, status: turn.status, slots: turn.slots, summary: turn.summary, mustDoItems: turn.mustDoItems }
          : prev
      )
      setEditing(null)
      setMustDoOpen(false)
      toast.success('수정했어요.')
    } catch (error) {
      if (isApiError(error) && error.httpStatus === 409) {
        // 이미 생성이 시작됐거나 끝난 세션 → 서버 상태로 화면 이동
        toast.show(error.message)
        setEditing(null)
        queryClient.invalidateQueries({ queryKey: goalCreationKeys.session(sessionId) })
        return
      }
      setSaveError(isApiError(error) ? error.message : '저장하지 못했어요. 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  const chooseStyle = (next: PlanningStyle) => {
    setStyle(next)
    setStyleByUser(true)
    markStyleSelectedByUser(sessionId)
  }

  const generate = async () => {
    if (generating) return
    setGenerating(true)
    try {
      // 성향은 사용자가 직접 골랐을 때만 보내요 (안 보내면 서버가 대화에서 추정한 값 사용)
      const res = await goalCreationApi.requestDraft(sessionId, styleByUser ? { planningStyle: style } : {})
      queryClient.removeQueries({ queryKey: goalCreationKeys.session(sessionId) })
      router.replace(goalFlowPath.generating(sessionId, res.draftId))
    } catch (error) {
      setGenerating(false)
      if (isApiError(error) && error.httpStatus === 409) {
        // 이미 생성 중 (다른 탭에서 눌렀거나 더블클릭) → 생성 중 화면으로
        router.replace(goalFlowPath.generating(sessionId))
        return
      }
      toast.error(isApiError(error) ? error.message : '계획을 만들지 못했어요. 다시 시도해 주세요.')
    }
  }

  const regenerate = session.status === 'DRAFT_READY'

  return (
    <FlowShell>
      <div className="flex-1 overflow-y-auto">
        <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-10 sm:px-6 sm:pt-12">
          <Badge tone="brand">
            <Sparkles className="size-3.5" />
            정리 확인
          </Badge>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-[28px]">이렇게 정리했어요</h1>
          <p className="text-ink-3 mt-1.5 text-[15px]">항목을 눌러 고칠 수 있어요. 확인되면 계획을 만들어 드릴게요.</p>

          <Section title="목표 정보">
            <div className="border-line divide-line divide-y overflow-hidden rounded-[18px] border">
              <SummaryRow
                label="목표"
                value={summary?.goalStatement ?? null}
                onClick={() => openEdit('goalStatement')}
              />
              <SummaryRow label="수치" value={summary?.metricText ?? null} onClick={() => openEdit('metric')} />
              <SummaryRow label="이유" value={summary?.motivation ?? null} onClick={() => openEdit('motivation')} />
              <SummaryRow label="기한" value={summary?.deadlineText ?? null} onClick={() => openEdit('deadline')} />
              <SummaryRow
                label="실천 시간"
                value={summary?.preferenceText ?? null}
                onClick={() => openEdit('practicePreference')}
              />
              <SummaryRow
                label="꼭 할 일"
                value={session.mustDoItems?.length ? session.mustDoItems.join(' · ') : null}
                onClick={() => {
                  setSaveError(null)
                  setMustDoDraft(session.mustDoItems ?? [])
                  setMustDoOpen(true)
                }}
              />
            </div>
          </Section>

          <Section
            title="실행 성향"
            aside={!styleByUser && <span className="text-ink-3 text-xs">대화를 바탕으로 AI가 골랐어요</span>}
          >
            <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="실행 성향">
              {(['PLANNER', 'SPONTANEOUS'] as const).map((value) => {
                const selected = style === value
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => chooseStyle(value)}
                    className={cn(
                      'rounded-2xl border p-4 text-left transition-colors',
                      selected ? 'border-brand bg-brand-soft' : 'border-line-strong hover:border-ink-4'
                    )}
                  >
                    <span className={cn('block text-[15px] font-bold', selected && 'text-brand')}>
                      {PLANNING_STYLE_LABEL[value]}
                    </span>
                    <span className="text-ink-3 mt-1 block text-[13px]">{STYLE_DESCRIPTION[value]}</span>
                  </button>
                )
              })}
            </div>
          </Section>
        </main>
      </div>

      <div className="border-line bg-surface border-t pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-2xl px-4 py-3 sm:px-6 sm:py-4">
          <Button variant="primary" size="lg" fullWidth onClick={generate} loading={generating}>
            {!generating && <Sparkles className="size-4" />}
            {regenerate ? '이 정보로 다시 만들기' : '계획 만들기'}
          </Button>
        </div>
      </div>

      <Modal
        open={mustDoOpen}
        onClose={() => !saving && setMustDoOpen(false)}
        title="꼭 하고 싶은 일"
        description="고른 일은 계획에 꼭 루틴으로 넣어 드려요."
        dismissible={!saving}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMustDoOpen(false)} disabled={saving}>
              취소
            </Button>
            <Button onClick={() => save({ mustDoItems: mustDoDraft })} loading={saving}>
              저장
            </Button>
          </>
        }
      >
        <MustDoPicker value={mustDoDraft} onChange={setMustDoDraft} disabled={saving} />
        {saveError && <p className="text-danger mt-2 text-[13px]">{saveError}</p>}
      </Modal>
      <SlotEditModal
        slot={editing}
        slots={session.slots}
        saving={saving}
        serverError={saveError}
        onClose={() => setEditing(null)}
        onSave={save}
      />
    </FlowShell>
  )
}
