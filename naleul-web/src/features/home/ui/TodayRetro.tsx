'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, ChevronDown, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { inlineInput } from '@/features/goal/edit/inline'
import { hexOf } from '@/features/timetable/layout'
import { useCreateTodayRetro, useDeleteRetro, useUpdateRetro, type HomeGoalToday, type HomeRetro } from '../api'

/** 목표 형태별 회고 질문 — 빈 칸 앞에서 막막하지 않게 */
function promptOf(g: HomeGoalToday) {
  if (g.goalMode === 'RECORD') return '오늘 일하며 막힌 점 · 배운 점 · 내일 바꿀 점'
  if (g.planned > 0 && g.done === 0) return '오늘 못 한 이유는 뭐였나요? 내일은 어떻게 해 볼까요?'
  return '오늘 목표에 얼마나 다가갔나요? 잘 된 점 · 아쉬운 점'
}

/**
 * 오늘 회고 — 진행 중인 목표마다 오늘 끝낸 일 · 못 한 일을 보면서 바로 한 줄 남겨요.
 * 오늘 할 일이 있었던 목표만 펼쳐 두고, 나머지는 "다른 목표"로 접어요.
 */
export function TodayRetro({
  goals,
  today,
  failed,
}: {
  goals: HomeGoalToday[] | undefined
  today: string
  failed: boolean
}) {
  const [showIdle, setShowIdle] = useState(false)
  if (failed) return null
  if (!goals) return <div className="bg-subtle h-40 animate-pulse rounded-[20px]" />
  if (goals.length === 0) return null

  const active = goals.filter((g) => g.activeToday)
  const idle = goals.filter((g) => !g.activeToday)
  const written = goals.filter((g) => g.retros.length > 0).length

  return (
    <section aria-labelledby="home-retro">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="home-retro" className="text-[19px] font-bold">
          오늘 회고
        </h2>
        <span className="text-ink-3 text-[13px]">
          {written > 0 ? `${written}개 목표에 남겼어요` : '오늘 한 일을 보면서 목표마다 한 줄씩 남겨 보세요'}
        </span>
      </div>
      {active.length === 0 && (
        <Card className="text-ink-3 mb-3 p-5 text-sm">
          오늘 목표와 연결된 할 일이 없었어요. 아래 목표에 생각을 남겨도 돼요.
        </Card>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        {(active.length > 0 ? active : idle.slice(0, 2)).map((g) => (
          <RetroCard key={g.goalCategoryId} goal={g} today={today} />
        ))}
      </div>
      {active.length > 0 && idle.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowIdle((v) => !v)}
            aria-expanded={showIdle}
            className="text-ink-3 hover:text-ink flex items-center gap-1 text-[13px] font-semibold"
          >
            오늘 할 일이 없던 목표 {idle.length}개
            <ChevronDown className={cn('size-4 transition-transform', showIdle && 'rotate-180')} />
          </button>
          {showIdle && (
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
              {idle.map((g) => (
                <RetroCard key={g.goalCategoryId} goal={g} today={today} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function RetroCard({ goal: g, today }: { goal: HomeGoalToday; today: string }) {
  const create = useCreateTodayRetro()
  const [text, setText] = useState('')
  const submit = () => {
    const v = text.trim()
    if (!v || create.isPending) return
    create.mutate({ goalCategoryId: g.goalCategoryId, content: v, date: today }, { onSuccess: () => setText('') })
  }

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-center gap-2">
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: hexOf(g.colorCode) }} aria-hidden />
        <Link
          href={`/goal/${g.goalCategoryId}`}
          className="min-w-0 flex-1 truncate text-[15px] font-bold hover:underline"
        >
          {g.emoji ? `${g.emoji} ` : ''}
          {g.goalName}
        </Link>
        {g.planned + g.done > 0 && (
          <span className="text-ink-3 shrink-0 text-[12px] tabular-nums">
            오늘 {g.done}
            {g.planned > 0 && ` / ${g.planned}`}개 끝냄
          </span>
        )}
      </div>

      {(g.doneTasks.length > 0 || g.openTasks.length > 0) && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {g.doneTasks.map((name, i) => (
            <li
              key={`d${i}`}
              className="bg-success-soft text-success flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold"
            >
              <Check className="size-3 shrink-0" strokeWidth={3} />
              <span className="truncate">{name}</span>
            </li>
          ))}
          {g.openTasks.map((name, i) => (
            <li
              key={`o${i}`}
              className="bg-subtle text-ink-3 max-w-full truncate rounded-full px-2.5 py-1 text-[12px] font-medium"
              title="오늘 못 한 일"
            >
              {name}
            </li>
          ))}
        </ul>
      )}

      {g.retros.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {g.retros.map((r) => (
            <RetroItem key={r.retrospectiveId} retro={r} />
          ))}
        </ul>
      )}

      <div className="mt-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          rows={2}
          aria-label={`${g.goalName} 오늘 회고`}
          placeholder={promptOf(g)}
          className={`${inlineInput} h-auto resize-none py-2 text-[14px] leading-relaxed`}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-ink-4 text-[11px]">Enter 저장 · Shift+Enter 줄바꿈</span>
          <Button size="sm" loading={create.isPending} disabled={!text.trim()} onClick={submit}>
            {g.retros.length > 0 ? '한 줄 더 남기기' : '회고 남기기'}
          </Button>
        </div>
      </div>
    </Card>
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
