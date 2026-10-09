import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/client/api'
import { goalKeys } from '@/features/goal/api'
import { timetableKeys } from '@/features/timetable/api'
import type { ExternalCalendarSource, ExternalEvent, ImportResult } from './types'

/** 서버 한 번 요청 한도 (ExternalEventImportRequest @Size(max = 300)) */
const CHUNK = 300

/** 고른 외부 일정을 Task 로 만들어요. 300개가 넘으면 나눠서 보내고 결과를 합쳐요 */
export function useImportExternalEvents() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      source: ExternalCalendarSource
      goalCategoryId: number | null
      events: ExternalEvent[]
    }) => {
      const total: ImportResult = { created: 0, skippedDuplicate: 0, skippedPast: 0, skippedInvalid: 0 }
      for (let i = 0; i < v.events.length; i += CHUNK) {
        const r = await api.post<ImportResult>('/v1/external-calendar/import', {
          source: v.source,
          goalCategoryId: v.goalCategoryId,
          events: v.events.slice(i, i + CHUNK),
        })
        total.created += r.created
        total.skippedDuplicate += r.skippedDuplicate
        total.skippedPast += r.skippedPast
        total.skippedInvalid += r.skippedInvalid
      }
      return total
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: timetableKeys.all })
      qc.invalidateQueries({ queryKey: goalKeys.all })
    },
  })
}
