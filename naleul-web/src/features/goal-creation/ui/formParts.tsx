import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export const inputClass =
  'border-line-strong bg-surface placeholder:text-ink-4 focus:border-ink-3 h-11 w-full rounded-xl border px-3.5 text-[15px] outline-none transition-colors'

export const textareaClass = cn(inputClass, 'h-auto resize-none py-3 leading-relaxed')

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-ink-2 mb-1.5 block text-[13px] font-semibold">{label}</span>
      {children}
      {hint && <span className="text-ink-3 mt-1 block text-xs">{hint}</span>}
    </label>
  )
}

/** "78" → 78, "" → null, "abc" → NaN */
export const toNumber = (v: string) => (v.trim() === '' ? null : Number(v))
