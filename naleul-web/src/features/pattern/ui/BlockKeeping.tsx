import type { PatternBlockKeeping } from '../types'
import { NotEnough, Section } from './Section'

/** 블록을 어떻게 지키나요? — 제시간 / 늦게 / 놓침 + 자주 옮기는 블록 */
export function BlockKeeping({ block }: { block?: PatternBlockKeeping | null }) {
  const hasRatio = block && block.total > 0 && block.onTime != null
  return (
    <Section
      title="블록을 어떻게 지키나요?"
      aside={block?.total ? `${block.total.toLocaleString()}개 기준` : undefined}
    >
      {!hasRatio ? (
        <NotEnough>시간을 정한 블록이 쌓이면 보여드려요</NotEnough>
      ) : (
        <>
          <div className="flex h-3.5 overflow-hidden rounded-full" aria-hidden>
            <span className="bg-success" style={{ width: `${block!.onTime}%` }} />
            <span className="bg-warning" style={{ width: `${block!.late}%` }} />
            <span className="bg-danger" style={{ width: `${block!.missed}%` }} />
          </div>
          <div className="text-ink-2 mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
            <Legend color="bg-success" label="제시간 시작" value={block!.onTime} />
            <Legend color="bg-warning" label="늦게 시작" value={block!.late} />
            <Legend color="bg-danger" label="놓침" value={block!.missed} />
          </div>
        </>
      )}

      <h3 className="mt-6 text-[15px] font-bold">자주 옮기는 블록</h3>
      {block?.frequentMoves.length ? (
        <ul className="divide-line mt-2 divide-y">
          {block.frequentMoves.map((m) => (
            <li key={`${m.routineId ?? m.title}`} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">
                  {m.emoji && <span className="mr-1">{m.emoji}</span>}
                  {m.title}
                </p>
                <p className="text-ink-3 mt-0.5 text-[13px]">{m.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-[14px]">
                <span className="text-ink-4 line-through">{m.fromLabel}</span>
                <span aria-label="에서">→</span>
                <span className="font-bold">{m.toLabel}</span>
                <span className="bg-subtle text-ink-2 rounded-md px-2 py-0.5 text-[12px] font-semibold">
                  {m.count}회
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-3 mt-2 text-[13px]">캘린더에서 블록을 옮긴 기록이 쌓이면 보여드려요</p>
      )}
    </Section>
  )
}

function Legend({ color, label, value }: { color: string; label: string; value?: number | null }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2.5 rounded-sm ${color}`} />
      {label} <b className="text-ink">{value ?? 0}%</b>
    </span>
  )
}
