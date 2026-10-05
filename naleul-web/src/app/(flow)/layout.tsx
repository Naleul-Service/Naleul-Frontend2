/**
 * 목표 만들기처럼 사이드바 없이 화면 전체를 쓰는 플로우용 레이아웃.
 * (로그인 확인은 proxy.ts 가 해요)
 */
export const dynamic = 'force-dynamic'

export default function FlowLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
