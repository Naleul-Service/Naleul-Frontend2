'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children?: ReactNode
  /** 하단 버튼 영역 */
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** 바깥 클릭으로 닫기 (기본 true). 저장 중엔 false 로 */
  dismissible?: boolean
}

const WIDTH = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-xl' }

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissible = true,
}: ModalProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  // onClose 가 렌더링마다 새 함수여도 아래 effect 가 다시 돌지 않도록 ref 에 보관
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // ESC 로 닫기 + 뒤 화면 스크롤 막기 + 열릴 때 포커스 이동
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) onCloseRef.current()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [open, dismissible])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 animate-[fade-in_150ms_ease-out] bg-black/40"
        onClick={dismissible ? onClose : undefined}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          'bg-surface shadow-pop relative flex max-h-[90dvh] w-full flex-col rounded-t-3xl outline-none sm:rounded-3xl',
          'animate-[modal-in_180ms_ease-out]',
          WIDTH[size]
        )}
      >
        {(title || dismissible) && (
          <div className="flex items-start justify-between gap-4 px-6 pt-6">
            <div className="min-w-0">
              {title && (
                <h2 id={titleId} className="text-lg font-bold">
                  {title}
                </h2>
              )}
              {description && <p className="text-ink-3 mt-1 text-sm leading-relaxed">{description}</p>}
            </div>
            {dismissible && (
              <button
                type="button"
                onClick={onClose}
                aria-label="닫기"
                className="text-ink-3 hover:bg-subtle hover:text-ink -mt-1 -mr-2 rounded-lg p-1.5"
              >
                <X className="size-5" />
              </button>
            )}
          </div>
        )}
        {children && <div className="overflow-y-auto px-6 pt-4 pb-2">{children}</div>}
        {footer && <div className="flex justify-end gap-2 px-6 pt-3 pb-6">{footer}</div>}
        {!footer && <div className="pb-4" />}
      </div>
    </div>,
    document.body
  )
}
