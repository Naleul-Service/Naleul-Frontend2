'use client'

import { Button } from '@/components/ui/Button'

/** 화면 렌더링 중 예상 못 한 에러가 났을 때 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  console.error(error)
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <h1 className="text-xl font-bold">문제가 생겼어요</h1>
        <p className="text-ink-3 mt-2 text-sm">잠시 후 다시 시도해 주세요.</p>
        <Button className="mt-6" onClick={reset}>
          다시 시도
        </Button>
      </div>
    </main>
  )
}
