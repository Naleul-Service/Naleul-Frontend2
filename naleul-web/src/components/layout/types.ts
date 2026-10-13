export interface SessionUserView {
  name: string
  /** GUEST = 로그인 없이 둘러보기 */
  role?: 'FREE' | 'PRO' | 'ADMIN' | 'GUEST'
}

export const isGuestUser = (u?: SessionUserView) => u?.role === 'GUEST'
