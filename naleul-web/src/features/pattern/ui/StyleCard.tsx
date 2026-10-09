import type { PatternStyle } from '../types'
import { INSIGHT_ICON } from '../format'
import { Emphasis } from './Emphasis'

/** 상단 검은 카드: AI가 분석한 나의 실행 스타일 */
export function StyleCard({ style }: { style?: PatternStyle | null }) {
  const ready = !!style?.title
  return (
    <section className="bg-inverse rounded-card flex h-full flex-col p-6 text-white sm:p-8" aria-label="나의 실행 스타일">
      <p className="text-[13px] text-white/60">✦ AI가 분석한 나의 실행 스타일</p>
      {ready ? (
        <>
          <h2 className="mt-2 text-[26px] leading-tight font-extrabold tracking-tight sm:text-[32px]">
            <Title title={style!.title!} highlight={style!.highlight} />
          </h2>
          <ul className="mt-5 flex flex-col gap-3">
            {style!.insights.map((it) => (
              <li
                key={it.key}
                className="flex items-start gap-3 text-[14px] leading-relaxed text-white/85 sm:text-[15px]"
              >
                <span
                  className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/10 text-[14px]"
                  aria-hidden
                >
                  {INSIGHT_ICON[it.icon] ?? '•'}
                </span>
                <span className="pt-0.5">
                  <Emphasis text={it.text} className="text-white" />
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <Locked style={style} />
      )}
    </section>
  )
}

/** "저녁에 강한 꾸준형" 에서 "저녁에 강한" 부분만 파란색 */
function Title({ title, highlight }: { title: string; highlight?: string | null }) {
  if (!highlight || !title.startsWith(highlight)) return <>{title}</>
  return (
    <>
      <span className="text-[#8c9bff]">{highlight}</span>
      {title.slice(highlight.length)}
    </>
  )
}

/**
 * 아직 기록이 부족할 때: 빈 화면 대신 "얼마나 더 하면 열리는지" 진행 바.
 * 예) 실행 스타일까지 Task 15개 · 4일 더
 */
export function Locked({ style }: { style?: PatternStyle | null }) {
  const p = style?.progress
  const remain = p
    ? [p.remainingTasks > 0 && `Task ${p.remainingTasks}개`, p.remainingDays > 0 && `${p.remainingDays}일`]
        .filter(Boolean)
        .join(' · ')
    : null
  return (
    <div className="mt-3">
      <h2 className="text-[22px] leading-snug font-extrabold">
        {remain ? (
          <>
            실행 스타일까지 <span className="text-[#8c9bff]">{remain}</span> 더
          </>
        ) : (
          '아직 스타일을 알기엔 기록이 적어요'
        )}
      </h2>
      <p className="mt-2 text-sm text-white/70">
        {p
          ? `Task ${p.requiredTasks}개를 ${p.requiredDays}일 이상에 걸쳐 실행하면 아침형·저녁형, 꾸준형·몰아치기형 같은 나만의 스타일을 알려드려요. 오늘 완료한 Task도 바로 반영돼요.`
          : style?.remainingForStyle
            ? `Task를 ${style.remainingForStyle}개 더 실행하면 나의 실행 스타일을 알려드릴게요.`
            : 'Task를 꾸준히 실행하면 나의 실행 스타일을 알려드릴게요.'}
      </p>
      {p && (
        <div className="mt-5 space-y-3.5">
          <Bar label="실행한 Task" value={p.evaluated} max={p.requiredTasks} unit="개" />
          <Bar label="실행한 날" value={p.activeDays} max={p.requiredDays} unit="일" />
        </div>
      )}
    </div>
  )
}

function Bar({ label, value, max, unit }: { label: string; value: number; max: number; unit: string }) {
  const ratio = Math.min(value / Math.max(max, 1), 1)
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
        <span className="text-white/70">{label}</span>
        <span className="font-semibold tabular-nums">
          {Math.min(value, max)}
          <span className="text-white/50">
            {' '}
            / {max}
            {unit}
          </span>
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-white/15"
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemax={max}
      >
        <div className="h-full rounded-full bg-[#8c9bff] transition-all" style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  )
}
