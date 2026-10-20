'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

/** 모달을 닫은 방법 (Amplitude close_method) */
export type ModalCloseMethod = 'x_button' | 'backdrop' | 'esc'

interface ModalProps {
  open: boolean
  /** method: 어떻게 닫혔는지 (필요한 곳만 받아서 써요) */
  onClose: (method: ModalCloseMethod) => void
  title?: ReactNode
  description?: ReactNode
  children?: ReactNode
  /** 하단 버튼 영역 */
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** 바깥 클릭으로 닫기 (기본 true). 저장 중엔 false 로 */
  dismissible?: boolean
}

const WIDTH = { sm: 'sm:max-w-[340px]', md: 'sm:max-w-md', lg: 'sm:max-w-xl' }

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
      if (e.key === 'Escape' && dismissible) onCloseRef.current('esc')
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
        className="bg-bg-overlay absolute inset-0 animate-[fade-in_150ms_ease-out]"
        onClick={dismissible ? () => onClose('backdrop') : undefined}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          // 디자인 시스템 Dialog — glass (반투명 바탕 + blur 16 + 1px glass 테두리) · 모서리 16 · 여백 20 · 간격 16
          'bg-glass-bg border-glass-border shadow-pop relative flex max-h-[90dvh] w-full flex-col border outline-none backdrop-blur-[16px]',
          'rounded-t-sheet sm:rounded-dialog',
          'animate-[modal-in_180ms_ease-out]',
          WIDTH[size]
        )}
      >
        {(title || dismissible) && (
          <div className="flex items-start justify-between gap-4 px-5 pt-5">
            <div className="min-w-0">
              {title && (
                <h2 id={titleId} className="text-h3 text-text-primary">
                  {title}
                </h2>
              )}
              {description && <p className="text-body-md text-text-secondary mt-1.5">{description}</p>}
            </div>
            {dismissible && (
              <button
                type="button"
                onClick={() => onClose('x_button')}
                aria-label="닫기"
                className="rounded-icon-btn text-text-secondary hover:bg-bg-subtle hover:text-text-primary -mt-1 -mr-1.5 grid size-8 shrink-0 place-items-center"
              >
                <X className="size-[18px]" strokeWidth={1.5} />
              </button>
            )}
          </div>
        )}
        {children && <div className="overflow-y-auto px-5 pt-4 pb-1">{children}</div>}
        {footer && (
          <div className="flex justify-end gap-2 px-5 pt-4 pb-[max(20px,env(safe-area-inset-bottom))] sm:pb-5">{footer}</div>
        )}
        {!footer && <div className="pb-4" />}
      </div>
    </div>,
    document.body
  )
}
