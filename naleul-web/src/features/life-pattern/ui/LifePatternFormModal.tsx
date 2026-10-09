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
import type { LifePattern, LifePatternDayTime, LifePatternType } from '@/features/timetable/types'
import type { LifePatternCreateInput } from '../api'
import { nightsToDayTimes, sleepConflictDay, sleepNights, type SleepNight } from '../dayTimes'
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

/** 요일별 시간 한 칸 (일반 고정 시간) */
type DayTimeMap = Partial<Record<JavaDayOfWeek, { start: string; end: string; offset: number }>>

const toDayTimeMap = (list?: LifePatternDayTime[]): DayTimeMap =>
  Object.fromEntries(
    (list ?? []).map((t) => [t.day, { start: toHm(t.startTime), end: toHm(t.endTime), offset: t.startDayOffset }])
  )

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

  // ── 요일별 시간 (기본은 모든 요일 같은 시간, 필요할 때만 펼쳐요) ──
  const isSleep = form.patternType === 'SLEEP'
  const [perDay, setPerDay] = useState(!!editing?.dayTimes?.length)
  const [dayMap, setDayMap] = useState<DayTimeMap>(() => toDayTimeMap(editing?.dayTimes))
  // 수면은 "밤" 단위 (월요일 밤 취침 → 화요일 아침 기상). 블록 소속 요일과 헷갈리지 않게 화면에선 밤으로 보여줘요
  const [nights, setNights] = useState<(SleepNight | null)[]>(() =>
    editing?.dayTimes?.length ? sleepNights(editing) : []
  )
  const defaultNight: SleepNight = { bed: form.startTime, wake: form.endTime }
  /** 밤 w 에 수면이 있는지 (기본 취침이 자정 이후면 다음 날 소속이라 그 요일 기준으로 봐요) */
  const nightShift = form.startTime && timeToMinutes(form.startTime) < 720 ? 1 : 0
  const hasNight = (w: number) => form.days.includes(ALL_DAYS[(w + nightShift) % 7])
  const nightAt = (w: number) => (hasNight(w) ? (nights[w] ?? defaultNight) : null)
  const allNights = ALL_DAYS.map((_, w) => nightAt(w))
  const sleepConflict = perDay && isSleep ? sleepConflictDay(allNights) : -1
  const setNight = (w: number, k: keyof SleepNight, v: string) =>
    setNights((list) => {
      const next = ALL_DAYS.map((_, i) => list[i] ?? null)
      next[w] = { ...(next[w] ?? defaultNight), [k]: v }
      return next
    })
  const dayTimeOf = (d: JavaDayOfWeek) => dayMap[d] ?? { start: form.startTime, end: form.endTime, offset: 0 }
  const setDayTime = (d: JavaDayOfWeek, k: 'start' | 'end', v: string) =>
    setDayMap((m) => ({ ...m, [d]: { ...dayTimeOf(d), [k]: v } }))
  const genericDayTimes = (): LifePatternDayTime[] =>
    form.days
      .map((d) => ({ d, t: dayTimeOf(d) }))
      .filter(({ t }) => t.offset !== 0 || t.start !== form.startTime || t.end !== form.endTime)
      .map(({ d, t }) => ({ day: d, startTime: t.start, endTime: t.end, startDayOffset: t.offset }))
  const badGenericDay = perDay && !isSleep ? form.days.find((d) => dayTimeOf(d).start === dayTimeOf(d).end) : undefined

  // 시간 계산: 종료가 시작보다 이르면 다음 날까지 (수면 23:00 ~ 07:00)
  const s = form.startTime ? timeToMinutes(form.startTime) : NaN
  const rawEnd = form.endTime ? timeToMinutes(form.endTime) : NaN
  const timeValid = !Number.isNaN(s) && !Number.isNaN(rawEnd) && s !== rawEnd
  const crosses = timeValid && rawEnd < s
  const e = crosses ? rawEnd + 1440 : rawEnd

  const title = form.title.trim()
  const valid =
    title.length > 0 && title.length <= 30 && timeValid && form.days.length > 0 && sleepConflict < 0 && !badGenericDay

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
      // 요일별을 끄면 [] → 모든 요일이 기본 시간으로 돌아가요
      dayTimes: perDay ? (isSleep ? nightsToDayTimes(form.startTime, form.endTime, allNights) : genericDayTimes()) : [],
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
            <Field label={isSleep ? (perDay ? '기본 취침' : '취침 시간') : perDay ? '기본 시작 시간' : '시작 시간'}>
              <input
                type="time"
                step={600}
                value={form.startTime}
                onChange={(ev) => set('startTime', ev.target.value)}
                className={inputClass}
                required
              />
            </Field>
            <Field label={isSleep ? (perDay ? '기본 기상' : '기상 시간') : perDay ? '기본 종료 시간' : '종료 시간'}>
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

        {/* 요일별 시간 — 예: 주말에는 늦게 일어나기 */}
        {timeValid &&
          form.days.length > 0 &&
          (perDay ? (
            <div className="bg-subtle/60 space-y-2 rounded-xl p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold">요일별 시간</p>
                <button
                  type="button"
                  onClick={() => {
                    setPerDay(false)
                    setDayMap({})
                    setNights([])
                  }}
                  className="text-ink-3 hover:text-ink text-[12px] font-semibold underline"
                >
                  모든 요일 같은 시간으로
                </button>
              </div>
              {isSleep ? (
                <ul className="space-y-1.5">
                  {ALL_DAYS.map((d, w) => {
                    const prev = (w + 6) % 7
                    const morning = nightAt(prev) // 전날 밤 → 이날 아침 기상
                    const night = nightAt(w) // 이날 밤 취침
                    const custom =
                      (!!morning && morning.wake !== defaultNight.wake) || (!!night && night.bed !== defaultNight.bed)
                    return (
                      <li key={d} className="flex items-center gap-2">
                        <span
                          className={cn(
                            'grid size-8 shrink-0 place-items-center rounded-lg text-[13px] font-bold',
                            custom ? 'bg-brand text-white' : 'bg-surface text-ink-2',
                            sleepConflict === w && 'ring-danger ring-2'
                          )}
                        >
                          {dayShort(d)}
                        </span>
                        <label className="flex min-w-0 flex-1 items-center gap-1.5">
                          <span className="text-ink-3 shrink-0 text-[11px]">☀️ 기상</span>
                          <input
                            type="time"
                            step={600}
                            value={morning?.wake ?? ''}
                            disabled={!morning}
                            onChange={(ev) => setNight(prev, 'wake', ev.target.value)}
                            aria-label={`${dayShort(d)}요일 기상`}
                            className={cn(inputClass, 'h-9 min-w-0 flex-1 px-2')}
                          />
                        </label>
                        <label className="flex min-w-0 flex-1 items-center gap-1.5">
                          <span className="text-ink-3 shrink-0 text-[11px]">🌙 취침</span>
                          <input
                            type="time"
                            step={600}
                            value={night?.bed ?? ''}
                            disabled={!night}
                            onChange={(ev) => setNight(w, 'bed', ev.target.value)}
                            aria-label={`${dayShort(d)}요일 밤 취침`}
                            className={cn(inputClass, 'h-9 min-w-0 flex-1 px-2')}
                          />
                        </label>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <ul className="space-y-1.5">
                  {ALL_DAYS.filter((d) => form.days.includes(d)).map((d) => {
                    const t = dayTimeOf(d)
                    const custom = t.offset !== 0 || t.start !== form.startTime || t.end !== form.endTime
                    return (
                      <li key={d} className="flex items-center gap-2">
                        <span
                          className={cn(
                            'grid size-8 shrink-0 place-items-center rounded-lg text-[13px] font-bold',
                            custom ? 'bg-brand text-white' : 'bg-surface text-ink-2'
                          )}
                        >
                          {dayShort(d)}
                        </span>
                        <input
                          type="time"
                          step={600}
                          value={t.start}
                          onChange={(ev) => setDayTime(d, 'start', ev.target.value)}
                          aria-label={`${dayShort(d)}요일 시작`}
                          className={cn(inputClass, 'h-9 min-w-0 flex-1 px-2')}
                        />
                        <span className="text-ink-4">~</span>
                        <input
                          type="time"
                          step={600}
                          value={t.end}
                          onChange={(ev) => setDayTime(d, 'end', ev.target.value)}
                          aria-label={`${dayShort(d)}요일 종료`}
                          className={cn(inputClass, 'h-9 min-w-0 flex-1 px-2')}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setDayMap((m) => {
                              const next = { ...m }
                              delete next[d]
                              return next
                            })
                          }
                          disabled={!custom}
                          className="text-ink-3 hover:text-ink w-12 shrink-0 text-[12px] font-semibold disabled:invisible"
                        >
                          기본으로
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
              <p className={cn('text-xs', sleepConflict >= 0 || badGenericDay ? 'text-danger' : 'text-ink-3')}>
                {sleepConflict >= 0
                  ? `${dayShort(ALL_DAYS[sleepConflict])}요일 기상이 그날 취침보다 늦어요.`
                  : badGenericDay
                    ? `${dayShort(badGenericDay)}요일 시작과 종료를 다르게 입력해 주세요.`
                    : isSleep
                      ? '파란 요일만 기본과 달라요. 예: 토·일 기상을 늦추면 주말 아침이 그만큼 비워져요.'
                      : `파란 요일만 기본 시간(${form.startTime}~${form.endTime})과 달라요.`}
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setPerDay(true)
                // 처음 펼치면 지금 기본 시간으로 채워요 (이미 요일별 시간이 있던 패턴은 그대로)
                if (!editing?.dayTimes?.length) {
                  setNights([])
                  setDayMap({})
                }
              }}
              className="text-brand self-start text-[13px] font-semibold"
            >
              + 요일마다 시간을 다르게 하기{isSleep ? ' (예: 주말엔 늦게 일어나기)' : ''}
            </button>
          ))}

        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
