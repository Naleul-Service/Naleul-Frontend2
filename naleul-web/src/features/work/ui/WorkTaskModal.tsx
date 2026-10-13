'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import { Field, inlineInput } from '@/features/goal/edit/inline'
import { todayKst } from '@/features/timetable/time'
import {
  useDeleteWorkTask,
  useUpdateWorkTask,
  type WorkColumn,
  type WorkTask,
  type WorkTaskPatch,
  type WorkTopic,
} from '../api'
import { COLUMN_LABEL } from '../format'

const COLUMNS: WorkColumn[] = ['NOT_STARTED', 'IN_PROGRESS', 'DONE']

/**
 * Task 자세히 보기 · 고치기 — 이름 · 주제 · 하는 날 · 마감 · 메모 · 칸.
 * 바뀐 값만 보내요 (지운 값은 clear 플래그로).
 */
export function WorkTaskModal({
  goalId,
  task,
  topics,
  onClose,
}: {
  goalId: number
  task: WorkTask
  topics: WorkTopic[]
  onClose: () => void
}) {
  const update = useUpdateWorkTask(goalId)
  const remove = useDeleteWorkTask(goalId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [f, setF] = useState({
    name: task.taskName,
    topicId: task.topicId,
    date: task.date ?? '',
    dueDate: task.dueDate ?? '',
    memo: task.memo ?? '',
    status: task.status,
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))
  const realTopics = topics.filter((t) => t.topicId !== null)
  const saving = update.isPending || remove.isPending

  const save = () => {
    const patch: WorkTaskPatch = {}
    const name = f.name.trim()
    if (name && name !== task.taskName) patch.taskName = name
    if (f.topicId !== task.topicId) {
      if (f.topicId === null) patch.clearTopic = true
      else patch.topicId = f.topicId
    }
    if (f.date !== (task.date ?? '')) {
      if (f.date) patch.date = f.date
      else patch.clearDate = true
    }
    if (f.dueDate !== (task.dueDate ?? '')) {
      if (f.dueDate) patch.dueDate = f.dueDate
      else patch.clearDueDate = true
    }
    if (f.memo.trim() !== (task.memo ?? '')) patch.memo = f.memo.trim()
    if (f.status !== task.status) patch.status = f.status
    if (Object.keys(patch).length === 0) return onClose()
    update.mutate({ taskId: task.taskId, ...patch }, { onSuccess: onClose })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={task.routine ? '반복 루틴 Task' : 'Task'}
      description={task.routine ? '루틴 Task는 업무 일지 탭의 루틴에서 바꿔 주세요.' : undefined}
      dismissible={!saving}
      footer={
        task.routine ? (
          <Button onClick={onClose}>닫기</Button>
        ) : confirmDelete ? (
          <>
            <span className="text-danger mr-auto self-center text-[13px] font-semibold">정말 지울까요?</span>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={saving}>
              취소
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => remove.mutate(task.taskId, { onSuccess: onClose })}
            >
              지우기
            </Button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-danger hover:bg-danger-soft mr-auto flex items-center gap-1 rounded-lg px-2 text-[13px] font-semibold"
            >
              <Trash2 className="size-3.5" />
              지우기
            </button>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              취소
            </Button>
            <Button loading={update.isPending} disabled={!f.name.trim()} onClick={save}>
              저장
            </Button>
          </>
        )
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!task.routine) save()
        }}
      >
        <Field label="이름">
          <input
            value={f.name}
            onChange={(e) => set('name', e.target.value)}
            maxLength={100}
            disabled={task.routine}
            className={inlineInput}
            autoFocus
          />
        </Field>

        <div>
          <span className="text-ink-3 mb-1 block text-[12px] font-medium">칸</span>
          <div className="bg-subtle inline-flex rounded-xl p-1" role="radiogroup" aria-label="칸">
            {COLUMNS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={f.status === c}
                disabled={task.routine}
                onClick={() => set('status', c)}
                className={cn(
                  'h-8 rounded-lg px-3 text-[13px] font-semibold transition-colors',
                  f.status === c ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2'
                )}
              >
                {COLUMN_LABEL[c]}
              </button>
            ))}
          </div>
        </div>

        {!task.routine && (
          <>
            <Field label="주제">
              <select
                value={f.topicId ?? ''}
                onChange={(e) => set('topicId', e.target.value ? Number(e.target.value) : null)}
                className={inlineInput}
              >
                <option value="">주제 없음</option>
                {realTopics.map((t) => (
                  <option key={t.topicId} value={t.topicId!}>
                    {t.emoji ? `${t.emoji} ` : ''}
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="하는 날 (비우면 할 일 목록)">
                <input
                  type="date"
                  value={f.date}
                  onChange={(e) => set('date', e.target.value)}
                  className={inlineInput}
                />
              </Field>
              <Field label="마감 (선택)">
                <input
                  type="date"
                  value={f.dueDate}
                  min={f.date || undefined}
                  onChange={(e) => set('dueDate', e.target.value)}
                  className={inlineInput}
                />
              </Field>
            </div>
            <div className="-mt-1 flex flex-wrap gap-1.5">
              <QuickDate label="오늘 하기" onClick={() => set('date', todayKst())} />
              {f.date && <QuickDate label="할 일 목록으로" onClick={() => set('date', '')} />}
              {f.dueDate && <QuickDate label="마감 지우기" onClick={() => set('dueDate', '')} />}
            </div>
            {task.startTime && f.date !== (task.date ?? '') && (
              <p className="text-ink-3 text-[12px]">
                날짜를 바꾸면 정해 둔 시간({task.startTime})은 풀리고 그날 자동으로 다시 배치돼요.
              </p>
            )}

            <Field label="메모 (선택 · 공유할 때 같이 보여요)">
              <textarea
                value={f.memo}
                onChange={(e) => set('memo', e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="예: 디자인 시안 v2 기준으로"
                className={`${inlineInput} h-auto resize-none py-2 leading-relaxed`}
              />
            </Field>
          </>
        )}
      </form>
    </Modal>
  )
}

function QuickDate({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-line text-ink-3 hover:border-line-strong hover:text-ink-2 h-7 rounded-full border px-2.5 text-[12px]"
    >
      {label}
    </button>
  )
}
