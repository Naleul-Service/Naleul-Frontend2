import type { PatternHeatmap } from '../types'
import { DAY_SHORT, HATCH, HEAT_BG, heatText, windowLabel } from '../format'
import { NotEnough, Section } from './Section'

/**
 * 언제 가장 잘 실행하나요? — 요일 × 시간에 실제로 한 횟수
 * 계획한 시간과 상관없이, 그 시간대에 Task · 루틴을 했으면 +1 이에요.
 * 가장 많이 한 칸이 가장 진하고, 한 번도 안 한 칸은 색이 없어요.
 */
export function Heatmap({ heatmap }: { heatmap?: PatternHeatmap | null }) {
  const hasValue = heatmap?.rows.some((r) => r.cells.some((c) => c.state === 'VALUE'))
  return (
    <Section title="언제 가장 잘 실행하나요?" aside="요일 × 시간 · 한 횟수">
      {!heatmap || !hasValue ? (
        <NotEnough>Task나 루틴을 완료하면 언제 많이 했는지 보여요</NotEnough>
      ) : (
        <>
          {/* 좁은 화면에서는 카드 안에서만 가로 스크롤 */}
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <table className="w-full min-w-[560px] border-separate border-spacing-[3px] text-center">
              <thead>
                <tr>
                  <th className="w-6" />
                  {heatmap.hours.map((h) => (
                    <th key={h} scope="col" className="text-ink-3 pb-1 text-[11px] font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.rows.map((row) => (
                  <tr key={row.dayOfWeek}>
                    <th scope="row" className="text-ink-2 pr-1 text-left text-[12px] font-medium">
                      {DAY_SHORT[row.dayOfWeek]}
                    </th>
                    {row.cells.map((c) => {
                      const label = `${DAY_SHORT[row.dayOfWeek]} ${c.hour}시`
                      if (c.state === 'VALUE' && c.level) {
                        return (
                          <td
                            key={c.hour}
                            title={`${label} · ${c.count ?? 0}번 했어요${c.rate != null ? ` · 계획 대비 ${c.rate}%` : ''}`}
                            className={`h-9 rounded-md text-[11px] font-semibold ${heatText(c.level)}`}
                            style={{ background: HEAT_BG[c.level] }}
                          >
                            {c.count ?? ''}
                          </td>
                        )
                      }
                      if (c.state === 'FIXED') {
                        return (
                          <td
                            key={c.hour}
                            title={`${label} · ${heatmap.fixedLabel ?? '고정 시간'}`}
                            className="h-9 rounded-md"
                            style={{ background: HATCH }}
                          />
                        )
                      }
                      return (
                        <td
                          key={c.hour}
                          title={`${label} · 한 게 없어요`}
                          className="border-line h-9 rounded-md border border-dashed"
                        />
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-ink-3 mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
            <span className="flex items-center gap-1.5">
              적게
              {[1, 2, 3, 4, 5].map((l) => (
                <span key={l} className="h-3 w-4 rounded-[3px]" style={{ background: HEAT_BG[l] }} />
              ))}
              많이{heatmap.maxCount ? ` (최대 ${heatmap.maxCount}번)` : ''}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-4 rounded-[3px]" style={{ background: HATCH }} />
              {heatmap.fixedLabel ?? '고정 시간'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="border-line h-3 w-4 rounded-[3px] border border-dashed" />한 게 없음
            </span>
          </div>

          {(heatmap.goldenTime || heatmap.weakTime) && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {heatmap.goldenTime && (
                <div className="bg-brand-soft flex items-center gap-3 rounded-2xl px-4 py-3.5">
                  <span className="text-brand text-[13px] font-bold whitespace-nowrap">🌟 골든 타임</span>
                  <div>
                    <p className="text-[16px] font-bold">{windowLabel(heatmap.goldenTime)}</p>
                    <p className="text-ink-3 text-[13px]">실행률 {heatmap.goldenTime.rate}%</p>
                  </div>
                </div>
              )}
              {heatmap.weakTime && (
                <div className="bg-danger-soft flex items-center gap-3 rounded-2xl px-4 py-3.5">
                  <span className="text-danger text-[13px] font-bold whitespace-nowrap">⚠️ 취약 시간</span>
                  <div>
                    <p className="text-[16px] font-bold">{windowLabel(heatmap.weakTime)}</p>
                    <p className="text-ink-3 text-[13px]">실행률 {heatmap.weakTime.rate}%</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Section>
  )
}
