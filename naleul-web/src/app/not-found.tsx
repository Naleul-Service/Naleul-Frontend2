import Link from 'next/link'
import { buttonClass } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="text-brand text-sm font-bold">404</p>
        <h1 className="mt-2 text-2xl font-bold">페이지를 찾을 수 없어요</h1>
        <p className="text-ink-3 mt-2 text-sm">주소가 바뀌었거나 삭제된 페이지예요.</p>
        <Link href="/" className={buttonClass('primary', 'md') + ' mt-6'}>
          홈으로
        </Link>
      </div>
    </main>
  )
}
