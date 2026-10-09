'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useUserColors } from '@/features/color/api'
import { ColorSwatches, Field, InlineForm, inlineInput } from '@/features/goal/edit/inline'
import { useCreateRecordGoal } from '../api'

type WorkKind = 'COMPANY_WORK' | 'SIDE_PROJECT'

/** 종류별 템플릿 — 이름 예시 · 한 줄 설명 안내 · 이모지 · "이런 Task가 쌓여요" 예시 */
const TEMPLATES: Record<
  WorkKind,
  {
    label: string
    hint: string
    names: string[]
    descLabel: string
    descPlaceholder: string
    emojis: string[]
    taskExamples: string[]
  }
> = {
  COMPANY_WORK: {
    label: '회사 업무',
    hint: '팀·회사에서 맡은 일',
    names: ['OO팀 업무', '나를 업무', '신규 서비스 기획', '고객 지원'],
    descLabel: '내가 맡은 일 (선택)',
    descPlaceholder: '예: 백엔드 API 개발과 배포 담당',
    emojis: ['💼', '📊', '🗂️', '🤝', '🧑‍💻'],
    taskExamples: ['주간 회의 준비', '기획서 작성', '코드 리뷰'],
  },
  SIDE_PROJECT: {
    label: '사이드 프로젝트',
    hint: '퇴근 후·주말에 만드는 것',
    names: ['포트폴리오 앱', '블로그 운영', '유튜브 채널', '오픈소스 기여'],
    descLabel: '무엇을 만드나요? (선택)',
    descPlaceholder: '예: 운동 기록을 친구와 공유하는 iOS 앱',
    emojis: ['🚀', '🧑‍💻', '📱', '✍️', '🎨'],
    taskExamples: ['로그인 화면 만들기', '글 1편 쓰기', '첫 배포하기'],
  },
}

const KINDS: WorkKind[] = ['COMPANY_WORK', 'SIDE_PROJECT']

/**
 * 업무형 목표 만들기 (goal_mode = RECORD, 종류 = 업무 · 회사 업무 / 사이드 프로젝트).
 * 기한·수치·세부 목표를 묻지 않아요. 종류를 고르면 이름 예시·이모지·안내 문구가 그 종류에 맞게 바뀌어요.
 * 만든 뒤에는 Task 를 완료할 때마다 업무 일지와 나의 패턴이 쌓여요.
 */
export function RecordGoalForm({ onCancel, className }: { onCancel: () => void; className?: string }) {
  const router = useRouter()
  const colors = useUserColors()
  const create = useCreateRecordGoal()
  const [kind, setKind] = useState<WorkKind>('COMPANY_WORK')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  // null 이면 종류의 기본 이모지 (종류를 바꾸면 같이 바뀌게)
  const [emoji, setEmoji] = useState<string | null>(null)
  const [colorId, setColorId] = useState<number | null>(null)
  const [styleOpen, setStyleOpen] = useState(false)

  const t = TEMPLATES[kind]
  const shownEmoji = emoji ?? t.emojis[0]
  const value = name.trim()

  const submit = () =>
    create.mutate(
      {
        name: value,
        emoji: shownEmoji,
        colorId,
        goalType: 'WORK',
        goalSubType: kind,
        description: description.trim() || null,
      },
      { onSuccess: (goal) => router.push(`/goal/${goal.goalCategoryId}`) }
    )

  return (
    <InlineForm
      onSubmit={submit}
      onCancel={onCancel}
      saving={create.isPending}
      valid={!!value}
      error={null}
      submitLabel="업무형 목표 만들기"
      className={className}
    >
      {/* ① 종류 */}
      <div>
        <span className="text-ink-3 mb-1 block text-[12px] font-medium">어떤 일인가요?</span>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="업무 종류">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => {
                setKind(k)
                setEmoji(null)
              }}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
                kind === k ? 'border-ink bg-subtle' : 'border-line hover:border-line-strong'
              )}
            >
              <span className="text-xl" aria-hidden>
                {TEMPLATES[k].emojis[0]}
              </span>
              <span>
                <span className="block text-[14px] font-bold">{TEMPLATES[k].label}</span>
                <span className="text-ink-3 block text-[12px]">{TEMPLATES[k].hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ② 이름 */}
      <Field label="이름">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder={`예: ${t.names[0]}`}
          className={inlineInput}
          data-autofocus
        />
      </Field>
      <div className="-mt-1 flex flex-wrap gap-1.5">
        {t.names.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setName(ex)}
            className="border-line text-ink-3 hover:border-line-strong hover:text-ink-2 h-7 rounded-full border px-2.5 text-[12px]"
          >
            {ex}
          </button>
        ))}
      </div>

      {/* ③ 한 줄 설명 */}
      <Field label={t.descLabel}>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={100}
          placeholder={t.descPlaceholder}
          className={inlineInput}
        />
      </Field>

      {/* ④ 꾸미기 — 기본값이 있어서 접어 둬요 */}
      <div>
        <button
          type="button"
          onClick={() => setStyleOpen((v) => !v)}
          aria-expanded={styleOpen}
          className="text-ink-2 hover:text-ink flex items-center gap-1.5 text-[13px] font-semibold"
        >
          <span className="text-base" aria-hidden>
            {shownEmoji}
          </span>
          이모지·색상 바꾸기
          <ChevronDown className={cn('size-4 transition-transform', styleOpen && 'rotate-180')} />
        </button>
        {styleOpen && (
          <div className="mt-2 space-y-3">
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="이모지">
              {t.emojis.map((e) => (
                <button
                  key={e}
                  type="button"
                  role="radio"
                  aria-checked={shownEmoji === e}
                  onClick={() => setEmoji(e)}
                  className={cn(
                    'grid size-9 place-items-center rounded-xl border text-lg',
                    shownEmoji === e ? 'border-ink bg-subtle' : 'border-line hover:border-line-strong'
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
            <Field label="색상 (선택 안 하면 자동)">
              <ColorSwatches colors={colors.data} value={colorId} onChange={setColorId} />
            </Field>
          </div>
        )}
      </div>

      {/* 예시 — 만든 뒤 어떻게 쓰는지 */}
      <p className="bg-subtle text-ink-2 rounded-xl px-3 py-2.5 text-[13px] leading-relaxed">
        기한·수치 없이 만들어요. 예를 들어 <b>{t.taskExamples.map((x) => `‘${x}’`).join(', ')}</b> 같은 Task를 완료할
        때마다 날짜별 업무 일지와 나의 패턴에 쌓여요.
      </p>
    </InlineForm>
  )
}
