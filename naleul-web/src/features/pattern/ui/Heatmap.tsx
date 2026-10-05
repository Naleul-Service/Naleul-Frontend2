import type { PatternHeatmap } from '../types'
import { DAY_SHORT, HATCH, HEAT_BG, heatText, windowLabel } from '../format'
import { NotEnough, Section } from './Section'

/** 언제 가장 잘 실행하나요? — 요일 × 시간 실행률 */
export function Heatmap({ heatmap }: { heatmap?: PatternHeatmap | null }) {
  const hasValue = heatmap?.rows.some((r) => r.cells.some((c) => c.state === 'VALUE'))
  return (
    <Section title="언제 가장 잘 실행하나요?" aside="요일 × 시간 · 실행률 %">
      {!heatmap || !hasValue ? (
        <NotEnough>시간을 정한 블록을 실행하면 시간대별 실행률이 보여요</NotEnough>
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
                            title={`${label} · 실행률 ${c.rate}% (${c.samples}개)`}
                            className={`h-9 rounded-md text-[11px] font-semibold ${heatText(c.level)}`}
                            style={{ background: HEAT_BG[c.level] }}
                          >
                            {c.rate}
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
                      return <td key={c.hour} title={`${label} · 블록 없음`} className="bg-subtle h-9 rounded-md" />
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-ink-3 mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
            <span className="flex items-center gap-1.5">
              낮음
              {[1, 2, 3, 4, 5].map((l) => (
                <span key={l} className="h-3 w-4 rounded-[3px]" style={{ background: HEAT_BG[l] }} />
              ))}
              높음
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-4 rounded-[3px]" style={{ background: HATCH }} />
              {heatmap.fixedLabel ?? '고정 시간'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="bg-subtle border-line h-3 w-4 rounded-[3px] border" />
              블록 없음
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
