import type { PatternStyle } from '../types'
import { INSIGHT_ICON } from '../format'
import { Emphasis } from './Emphasis'

/** 상단 검은 카드: AI가 분석한 나의 실행 스타일 */
export function StyleCard({ style }: { style?: PatternStyle | null }) {
  const ready = !!style?.title
  return (
    <section className="bg-ink rounded-card flex h-full flex-col p-6 text-white sm:p-8" aria-label="나의 실행 스타일">
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
        <div className="mt-3">
          <h2 className="text-[22px] font-extrabold">아직 스타일을 알기엔 기록이 적어요</h2>
          <p className="mt-2 text-sm text-white/70">
            {style?.remainingForStyle
              ? `Task를 ${style.remainingForStyle}개 더 실행하면 나의 실행 스타일을 알려드릴게요.`
              : 'Task를 꾸준히 실행하면 나의 실행 스타일을 알려드릴게요.'}
          </p>
        </div>
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
