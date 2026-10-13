/** 지금 보던 화면으로 돌아오도록 /login?redirect=... */
export function loginHref() {
  if (typeof window === 'undefined') return '/login'
  const here = window.location.pathname + window.location.search
  return here === '/' ? '/login' : `/login?redirect=${encodeURIComponent(here)}`
}
