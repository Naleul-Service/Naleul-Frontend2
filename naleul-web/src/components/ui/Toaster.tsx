'use client'

import { CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useToastStore } from '@/stores/toastStore'

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={cn(
            'pointer-events-auto flex max-w-md items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium text-white',
            'shadow-pop animate-[toast-in_180ms_ease-out]',
            t.tone === 'error' ? 'bg-danger' : 'bg-ink'
          )}
        >
          {t.tone === 'success' && <CheckCircle2 className="text-success size-4 shrink-0" />}
          {t.tone === 'error' && <AlertCircle className="size-4 shrink-0" />}
          {t.message}
        </button>
      ))}
    </div>
  )
}
