'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Library, Pencil, PencilLine, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { inlineInput } from '@/features/goal/edit/inline'
import { hexOf } from '@/features/timetable/layout'
import { todayKst } from '@/features/timetable/time'
import {
  checkInWritten,
  useCreateTodayRetro,
  useDeleteRetro,
  useUpdateRetro,
  type HomeGoalToday,
  type HomeRetro,
} from '../api'
import { HomeCheckInForm } from './HomeCheckInForm'

/** 그날 남긴 게 있는지 — 목표형은 "오늘 기록"(수치 · 기분 · 회고), 업무형은 회고 글 */
export const hasRecord = (g: HomeGoalToday) => g.retros.length > 0 || checkInWritten(g.checkIn)

/** 목표 형태별 회고 질문 — 빈 칸 앞에서 막막하지 않게 */
function promptOf(g: HomeGoalToday) {
  if (g.goalMode === 'RECORD') return '오늘 일하며 막힌 점 · 배운 점 · 내일 바꿀 점'
  if (g.planned > 0 && g.done === 0) return '오늘 못 한 이유는 뭐였나요? 내일은 어떻게 해 볼까요?'
  return '오늘 목표에 얼마나 다가갔나요? 잘 된 점 · 아쉬운 점'
}

/** 아직 회고를 안 쓴 다음 목표 (오늘 할 일이 있던 목표 → 그다음 나머지 순, 지금 목표는 빼고) */
function nextGoal(goals: HomeGoalToday[], after: number | null, written: Set<number>) {
  const order = goals.filter((g) => g.activeToday)
  const start = after === null ? -1 : order.findIndex((g) => g.goalCategoryId === after)
  const rest = [...order.slice(start + 1), ...order.slice(0, Math.max(start, 0))]
  return rest.find((g) => !hasRecord(g) && !written.has(g.goalCategoryId) && g.goalCategoryId !== after) ?? null
}

/**
 * 오늘 회고 (홈 오른쪽 패널) — 목표를 하나씩 고를 필요 없이 입력창 하나로 써요.
 *  - 목표형: 목표 상세 "오늘 기록"과 같은 칸 (수치 + 오늘 어땠는지 + 한 줄 회고) — 어디서 쓰든 같은 기록이에요
 *  - 업무형: 지금처럼 회고 글
 *  - 오늘 할 일이 있던 목표 중 아직 회고가 없는 것부터 자동으로 골라 둬요
 *  - Enter 로 저장하면 다음 목표로 넘어가요 (건너뛰기도 가능) · Shift+Enter 줄바꿈
 *  - 위의 목표 칩을 눌러 직접 고를 수도 있어요 (✓ = 오늘 회고 있음)
 */
export function RetroPanel({
  goals,
  today,
  failed,
  bare = false,
}: {
  goals: HomeGoalToday[] | undefined
  today: string
  failed: boolean
  /** 오른쪽 패널 안에 넣을 때 — 카드 · 제목 없이 */
  bare?: boolean
}) {
  const create = useCreateTodayRetro()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [finished, setFinished] = useState(false)
  // 저장 직후 서버 응답이 오기 전에도 "썼다"로 보이게
  const [written, setWritten] = useState<Set<number>>(new Set())
  const [text, setText] = useState('')
  const [showIdle, setShowIdle] = useState(false)

  if (failed) return <p className="text-ink-3 text-sm">회고할 목표를 불러오지 못했어요.</p>
  if (!goals) return <div className="bg-subtle h-60 animate-pulse rounded-[20px]" />
  if (goals.length === 0) return <p className="text-ink-3 text-sm">진행 중인 목표가 없어요.</p>

  const hasRetro = (g: HomeGoalToday) => hasRecord(g) || written.has(g.goalCategoryId)
  // 앞날은 아직 기록할 수 없어요 (목표형 기록은 서버도 미래 날짜를 막아요)
  const future = today > todayKst()
  const auto = nextGoal(goals, null, written) ?? goals.find((g) => g.activeToday) ?? goals[0]
  const current = finished ? null : (goals.find((g) => g.goalCategoryId === picked) ?? auto)
  const active = goals.filter((g) => g.activeToday)
  const idle = goals.filter((g) => !g.activeToday)
  const doneCount = active.filter(hasRetro).length

  const Wrap = bare ? 'div' : Card
  const focus = () => requestAnimationFrame(() => inputRef.current?.focus())
  const pick = (id: number) => {
    setPicked(id)
    setFinished(false)
    focus()
  }
  const goNext = (from: number, justWrote: boolean) => {
    const w = justWrote ? new Set([...written, from]) : written
    const n = nextGoal(goals, from, w)
    if (n) {
      setPicked(n.goalCategoryId)
      focus()
    } else {
      setPicked(null)
      setFinished(true)
    }
  }
  const submit = () => {
    const v = text.trim()
    if (!v || !current || create.isPending) return
    const id = current.goalCategoryId
    create.mutate(
      { goalCategoryId: id, content: v, date: today },
      {
        onSuccess: () => {
          setText('')
          setWritten((s) => new Set([...s, id]))
          goNext(id, true)
        },
      }
    )
  }

  const chip = (g: HomeGoalToday) => (
    <button
      key={g.goalCategoryId}
      type="button"
      onClick={() => pick(g.goalCategoryId)}
      aria-pressed={current?.goalCategoryId === g.goalCategoryId}
      className={cn(
        'flex h-8 max-w-full items-center gap-1 rounded-full border px-2.5 text-[12px] font-semibold transition-colors',
        current?.goalCategoryId === g.goalCategoryId
          ? 'border-ink bg-ink text-on-ink'
          : 'border-line-strong bg-surface text-ink-2 hover:border-ink-4'
      )}
    >
      {hasRetro(g) ? (
        <Check className="text-success size-3.5 shrink-0" strokeWidth={3} />
      ) : (
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: hexOf(g.colorCode) }} aria-hidden />
      )}
      <span className="truncate">
        {g.emoji ? `${g.emoji} ` : ''}
        {g.goalName}
      </span>
    </button>
  )

  return (
    <Wrap id="home-retro" className={bare ? undefined : 'p-4 sm:p-5'}>
      <div className="flex items-baseline gap-2">
        {!bare && (
          <h2 className="flex items-center gap-1.5 text-[17px] font-bold">
            <PencilLine className="size-4" />
            오늘 회고
          </h2>
        )}
        {bare && <p className="text-ink-3 text-[13px]">오늘 한 일을 보면서 목표마다 한 줄씩</p>}
        {active.length > 0 && (
          <span className="text-ink-3 ml-auto text-[12px] tabular-nums">
            {doneCount} / {active.length} 목표
          </span>
        )}
      </div>
      <Link
        href="/reflections"
        className="text-brand hover:bg-brand-soft mt-1 -ml-1 inline-flex items-center gap-1 rounded-lg px-1 py-0.5 text-[12px] font-semibold"
      >
        <Library className="size-3.5" />
        지난 회고 모아보기
      </Link>

      {/* 목표 고르기 — 자동으로 골라 두지만 눌러서 바꿀 수 있어요 */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(active.length ? active : idle).map(chip)}
        {active.length > 0 && idle.length > 0 && !showIdle && (
          <button
            type="button"
            onClick={() => setShowIdle(true)}
            className="text-ink-3 hover:text-ink h-8 px-1.5 text-[12px] font-semibold"
          >
            + 다른 목표 {idle.length}
          </button>
        )}
        {active.length > 0 && showIdle && idle.map(chip)}
      </div>

      {current ? (
        <div className="mt-4">
          <div className="text-ink-3 flex items-center gap-1.5 text-[12px]">
            <span className="size-2 rounded-full" style={{ backgroundColor: hexOf(current.colorCode) }} aria-hidden />
            <Link href={`/goal/${current.goalCategoryId}`} className="text-ink truncate font-bold hover:underline">
              {current.goalName}
            </Link>
            {current.planned + current.done > 0 && (
              <span className="shrink-0 tabular-nums">
                · 오늘 {current.done}
                {current.planned > 0 && `/${current.planned}`}개 끝냄
              </span>
            )}
          </div>

          {(current.doneTasks.length > 0 || current.openTasks.length > 0) && (
            <ul className="mt-2 flex flex-wrap gap-1">
              {current.doneTasks.map((name, i) => (
                <li
                  key={`d${i}`}
                  className="bg-success-soft text-success flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                >
                  <Check className="size-3 shrink-0" strokeWidth={3} />
                  <span className="truncate">{name}</span>
                </li>
              ))}
              {current.openTasks.map((name, i) => (
                <li
                  key={`o${i}`}
                  title="오늘 못 한 일"
                  className="bg-subtle text-ink-3 max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-medium"
                >
                  {name}
                </li>
              ))}
            </ul>
          )}

          {current.retros.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {current.retros.map((r) => (
                <RetroItem key={r.retrospectiveId} retro={r} />
              ))}
            </ul>
          )}

          {future ? (
            <p className="text-ink-3 bg-subtle mt-3 rounded-xl px-3 py-3 text-[13px]">
              앞날은 아직 기록할 수 없어요. 그날이 되면 남겨 주세요.
            </p>
          ) : current.checkIn ? (
            <HomeCheckInForm
              key={current.goalCategoryId}
              goalCategoryId={current.goalCategoryId}
              goalName={current.goalName}
              date={today}
              checkIn={current.checkIn}
              prompt={promptOf(current)}
              onSaved={() => {
                setWritten((s) => new Set([...s, current.goalCategoryId]))
                goNext(current.goalCategoryId, true)
              }}
              onSkip={() => goNext(current.goalCategoryId, false)}
            />
          ) : (
            <>
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    submit()
                  }
                }}
                rows={4}
                aria-label={`${current.goalName} 오늘 회고`}
                placeholder={promptOf(current)}
                className={`${inlineInput} mt-3 h-auto resize-none py-2.5 text-[14px] leading-relaxed`}
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goNext(current.goalCategoryId, false)}
                  className="text-ink-3 hover:text-ink text-[13px] font-semibold"
                >
                  건너뛰기
                </button>
                <Button
                  size="sm"
                  className="ml-auto"
                  loading={create.isPending}
                  disabled={!text.trim()}
                  onClick={submit}
                >
                  저장하고 다음
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
              <p className="text-ink-4 mt-1.5 text-[11px]">Enter 저장 후 다음 목표로 · Shift+Enter 줄바꿈</p>
            </>
          )}
        </div>
      ) : (
        <div className="mt-5 py-4 text-center">
          <p className="text-[15px] font-bold">오늘 회고를 모두 남겼어요 🎉</p>
          <p className="text-ink-3 mt-1 text-[13px]">더 쓰고 싶은 목표가 있으면 위에서 골라 주세요.</p>
        </div>
      )}
    </Wrap>
  )
}

function RetroItem({ retro }: { retro: HomeRetro }) {
  const update = useUpdateRetro()
  const remove = useDeleteRetro()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(retro.content)

  if (editing) {
    return (
      <li>
        <textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
          rows={2}
          aria-label="회고 고치기"
          className={`${inlineInput} h-auto resize-none py-2 text-[14px] leading-relaxed`}
        />
        <div className="mt-1.5 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            취소
          </Button>
          <Button
            size="sm"
            loading={update.isPending}
            disabled={!value.trim()}
            onClick={() =>
              update.mutate(
                { retrospectiveId: retro.retrospectiveId, content: value.trim() },
                { onSuccess: () => setEditing(false) }
              )
            }
          >
            저장
          </Button>
        </div>
      </li>
    )
  }
  return (
    <li className="bg-subtle/70 group flex gap-2 rounded-xl px-3 py-2">
      <p className="min-w-0 flex-1 text-[13px] leading-5 whitespace-pre-wrap">{retro.content}</p>
      <span className="flex shrink-0 gap-0.5 self-start [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
        <button
          type="button"
          onClick={() => {
            setValue(retro.content)
            setEditing(true)
          }}
          aria-label="회고 고치기"
          className="text-ink-4 hover:text-ink p-0.5"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => remove.mutate(retro.retrospectiveId)}
          aria-label="회고 지우기"
          className="text-ink-4 hover:text-danger p-0.5"
        >
          <Trash2 className="size-3.5" />
        </button>
      </span>
    </li>
  )
}
