'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import type { JavaDayOfWeek } from '@/features/goal/api'
import { Field, inputClass } from '@/features/goal-creation/ui/formParts'
import { formatDuration, timeToMinutes } from '@/features/timetable/time'
import type { LifePattern, LifePatternType } from '@/features/timetable/types'
import type { LifePatternCreateInput } from '../api'
import {
  ALL_DAYS,
  TYPE_LABEL,
  WEEKDAYS,
  WEEKEND,
  dayShort,
  existingOfType,
  matchPresets,
  toHm,
  type LifePatternPreset,
} from '../presets'

export interface LifePatternFormValue {
  patternType: LifePatternType
  title: string
  emoji: string
  startTime: string
  endTime: string
  days: JavaDayOfWeek[]
}

interface Props {
  /** 수정할 패턴. 없으면 추가 */
  editing?: LifePattern | null
  /** 추가할 때 처음 채울 값 (페이지의 추천 칩에서 열었을 때) */
  initial?: LifePatternFormValue | null
  /** 이미 있는 패턴 (수면·점심·저녁 중복 추천 막기) */
  patterns: LifePattern[]
  loading?: boolean
  onSubmit: (v: LifePatternCreateInput) => void
  /** 추천을 눌렀는데 같은 종류(수면 등)가 이미 있으면 그걸 수정하러 가요 */
  onEditExisting: (p: LifePattern) => void
  onClose: () => void
}

const EMPTY: LifePatternFormValue = {
  patternType: 'CUSTOM',
  title: '',
  emoji: '',
  startTime: '09:00',
  endTime: '10:00',
  days: ALL_DAYS,
}

export const presetToForm = (p: LifePatternPreset): LifePatternFormValue => ({
  patternType: p.patternType,
  title: p.title,
  emoji: p.emoji,
  startTime: p.startTime,
  endTime: p.endTime,
  days: [...p.days],
})

const fromPattern = (p: LifePattern): LifePatternFormValue => ({
  patternType: p.patternType,
  title: p.title,
  emoji: p.emoji ?? '',
  startTime: toHm(p.startTime),
  endTime: toHm(p.endTime),
  days: p.days.length ? [...p.days] : ALL_DAYS,
})

/**
 * 고정 시간 추가·수정 모달.
 * 제목 · 이모지 · 시작/종료 시각 · 반복 요일을 받아요.
 * 추가할 때는 제목 아래 추천(+이동시간 +수면시간 +외출준비 …)을 누르면 한 번에 채워져요.
 * 부모에서 key 를 바꿔 열 때마다 초기값으로 다시 그려요.
 */
export function LifePatternFormModal({
  editing,
  initial,
  patterns,
  loading,
  onSubmit,
  onEditExisting,
  onClose,
}: Props) {
  const isEdit = !!editing
  const [form, setForm] = useState<LifePatternFormValue>(() => (editing ? fromPattern(editing) : (initial ?? EMPTY)))
  const set = <K extends keyof LifePatternFormValue>(k: K, v: LifePatternFormValue[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  // 시간 계산: 종료가 시작보다 이르면 다음 날까지 (수면 23:00 ~ 07:00)
  const s = form.startTime ? timeToMinutes(form.startTime) : NaN
  const rawEnd = form.endTime ? timeToMinutes(form.endTime) : NaN
  const timeValid = !Number.isNaN(s) && !Number.isNaN(rawEnd) && s !== rawEnd
  const crosses = timeValid && rawEnd < s
  const e = crosses ? rawEnd + 1440 : rawEnd

  const title = form.title.trim()
  const valid = title.length > 0 && title.length <= 30 && timeValid && form.days.length > 0

  // 추천: 추가할 때만, 입력한 제목과 맞는 것
  const suggestions = isEdit ? [] : matchPresets(form.title)

  const applyPreset = (p: LifePatternPreset) => {
    const existing = existingOfType(patterns, p)
    if (existing) {
      onEditExisting(existing)
      return
    }
    setForm(presetToForm(p))
  }

  // 제목을 직접 바꾸면 수면·점심·저녁 추천에서 벗어난 것으로 보고 일반 고정 일정으로 저장해요
  // (수정할 때는 종류를 바꿀 수 없어요)
  const onTitleChange = (v: string) =>
    setForm((f) => ({
      ...f,
      title: v,
      patternType: isEdit || v.trim() === TYPE_LABEL[f.patternType] ? f.patternType : 'CUSTOM',
    }))

  const toggleDay = (d: JavaDayOfWeek) =>
    set(
      'days',
      form.days.includes(d)
        ? form.days.filter((x) => x !== d)
        : ALL_DAYS.filter((x) => x === d || form.days.includes(x))
    )

  const isSet = (target: JavaDayOfWeek[]) =>
    form.days.length === target.length && target.every((d) => form.days.includes(d))

  const submit = () => {
    if (!valid || loading) return
    onSubmit({
      patternType: form.patternType,
      title,
      emoji: form.emoji.trim() || null,
      startTime: form.startTime,
      endTime: form.endTime,
      // 7개 다 고르면 매일 (백엔드는 빈 배열도 매일로 봐요)
      days: form.days.length === 7 ? [] : form.days,
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? '고정 시간 수정' : '고정 시간 추가'}
      description={
        isEdit
          ? '저장하면 오늘부터 모든 날짜의 기본 시간이 바뀌어요.'
          : '매주 반복되는 시간을 등록하면 이 시간은 비워두고 Task를 배치해요.'
      }
      size="md"
      dismissible={!loading}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            취소
          </Button>
          <Button onClick={submit} disabled={!valid} loading={loading}>
            {isEdit ? '저장' : '추가'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(ev) => {
          ev.preventDefault()
          submit()
        }}
      >
        {/* 제목 + 이모지 */}
        <div>
          <div className="grid grid-cols-[72px_1fr] gap-2">
            <Field label="이모지">
              <input
                value={form.emoji}
                onChange={(ev) => set('emoji', ev.target.value)}
                maxLength={16}
                placeholder="🙂"
                className={cn(inputClass, 'text-center')}
                aria-label="이모지"
              />
            </Field>
            <Field label="제목">
              <input
                value={form.title}
                onChange={(ev) => onTitleChange(ev.target.value)}
                maxLength={30}
                placeholder="예: 출근, 운동, 외출준비"
                className={inputClass}
                autoFocus={!isEdit}
                required
              />
            </Field>
          </div>

          {suggestions.length > 0 && (
            <div className="mt-2.5">
              <p className="text-ink-3 mb-1.5 flex items-center gap-1 text-xs font-medium">
                <Sparkles className="size-3.5" />
                추천
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((p) => {
                  const existing = existingOfType(patterns, p)
                  return (
                    <Chip
                      key={p.key}
                      size="sm"
                      selected={form.title === p.title && form.patternType === p.patternType}
                      onClick={() => applyPreset(p)}
                      title={existing ? `이미 있는 ${p.label}을 수정해요` : `${p.startTime}–${p.endTime}로 채워요`}
                    >
                      {existing ? `${p.emoji} ${p.label} 수정` : `+ ${p.label}`}
                    </Chip>
                  )
                })}
              </div>
            </div>
          )}

          {form.patternType !== 'CUSTOM' && (
            <p className="text-ink-3 mt-2 text-xs">
              종류: <b className="text-ink-2">{TYPE_LABEL[form.patternType]}</b>
              {form.patternType === 'SLEEP' && ' · 수면 시간은 하루의 시작(기상)과 끝(취침) 기준으로도 쓰여요.'}
            </p>
          )}
        </div>

        {/* 시간 */}
        <div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="시작 시간">
              <input
                type="time"
                step={600}
                value={form.startTime}
                onChange={(ev) => set('startTime', ev.target.value)}
                className={inputClass}
                required
              />
            </Field>
            <Field label="종료 시간">
              <input
                type="time"
                step={600}
                value={form.endTime}
                onChange={(ev) => set('endTime', ev.target.value)}
                className={inputClass}
                required
              />
            </Field>
          </div>
          <p className={cn('mt-1.5 min-h-5 text-xs', timeValid ? 'text-ink-3' : 'text-danger')}>
            {!timeValid
              ? '시작과 종료 시간을 다르게 입력해 주세요.'
              : `${formatDuration(e - s)}${crosses ? ' · 다음 날까지 이어져요' : ''}`}
          </p>
        </div>

        {/* 반복 요일 */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-ink-2 text-[13px] font-semibold">반복 요일</span>
            <div className="flex gap-1">
              {(
                [
                  ['매일', ALL_DAYS],
                  ['평일', WEEKDAYS],
                  ['주말', WEEKEND],
                ] as const
              ).map(([label, days]) => (
                <Chip key={label} size="sm" selected={isSet([...days])} onClick={() => set('days', [...days])}>
                  {label}
                </Chip>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="반복 요일">
            {ALL_DAYS.map((d) => (
              <Chip
                key={d}
                selected={form.days.includes(d)}
                onClick={() => toggleDay(d)}
                className={cn('px-0', (d === 'SATURDAY' || d === 'SUNDAY') && !form.days.includes(d) && 'text-ink-3')}
              >
                {dayShort(d)}
              </Chip>
            ))}
          </div>
          {form.days.length === 0 && <p className="text-danger mt-1.5 text-xs">요일을 하나 이상 골라 주세요.</p>}
        </div>

        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
