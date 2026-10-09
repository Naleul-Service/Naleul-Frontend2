'use client'

import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useThemePref, type ThemePref } from './theme'

const OPTIONS: { value: ThemePref; label: string; icon: LucideIcon }[] = [
  { value: 'system', label: '시스템', icon: Monitor },
  { value: 'light', label: '라이트', icon: Sun },
  { value: 'dark', label: '다크', icon: Moon },
]

/** 설정 > 화면 모드 */
export function ThemePicker() {
  const [pref, setPref] = useThemePref()
  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold">화면 모드</p>
        <p className="text-ink-3 mt-0.5 text-[13px]">시스템을 고르면 기기 설정(라이트·다크)을 따라가요</p>
      </div>
      <div role="radiogroup" aria-label="화면 모드" className="bg-subtle flex rounded-xl p-1">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={pref === value}
            onClick={() => setPref(value)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors',
              pref === value ? 'bg-surface text-ink shadow-card' : 'text-ink-3 hover:text-ink'
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
