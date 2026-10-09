'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { isApiError } from '@/lib/client/api'
import { cn } from '@/lib/cn'
import { toast } from '@/stores/toastStore'
import { NICKNAME_HELP, NICKNAME_PATTERN, useUpdateNickname } from '../api'

/** iOS ProfileView(프로필 수정)를 모달로 옮긴 것 — 닉네임만 바꿔요 */
export function ProfileEditModal({
  open,
  currentName,
  onClose,
}: {
  open: boolean
  currentName: string
  onClose: () => void
}) {
  const [nickname, setNickname] = useState(currentName)
  const [error, setError] = useState<string | null>(null)
  const update = useUpdateNickname()

  const trimmed = nickname.trim()
  const valid = NICKNAME_PATTERN.test(trimmed)

  const submit = () => {
    if (!valid) {
      setError(NICKNAME_HELP)
      return
    }
    update.mutate(trimmed, {
      onSuccess: () => {
        toast.success('닉네임을 바꿨어요.')
        onClose()
      },
      onError: (e) => setError(isApiError(e) ? e.message : '닉네임 수정에 실패했어요. 다시 시도해 주세요.'),
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="프로필 수정"
      dismissible={!update.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={update.isPending}>
            취소
          </Button>
          <Button onClick={submit} disabled={!valid || trimmed === currentName} loading={update.isPending}>
            저장
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <label className="block">
          <span className="text-ink-3 mb-1 block text-xs font-medium">
            닉네임 <span className="text-danger">*</span>
          </span>
          <input
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value)
              setError(null)
            }}
            maxLength={10}
            placeholder="이름을 작성해주세요"
            autoFocus
            aria-invalid={!!error}
            className={cn(
              'h-11 w-full rounded-xl border bg-surface px-3 text-[15px] outline-none',
              error ? 'border-danger' : 'border-line-strong focus:border-brand'
            )}
          />
        </label>
        <p className={cn('mt-1.5 text-xs', error ? 'text-danger' : 'text-ink-3')}>{error ?? NICKNAME_HELP}</p>
      </form>
    </Modal>
  )
}
