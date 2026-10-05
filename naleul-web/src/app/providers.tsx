'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, type ReactNode } from 'react'
import { isApiError } from '@/lib/client/api'
import { Toaster } from '@/components/ui/Toaster'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // 4xx 는 다시 시도해도 결과가 같으니 재시도하지 않아요. 네트워크/5xx 만 1번.
        retry: (count, error) => {
          if (isApiError(error) && error.httpStatus >= 400 && error.httpStatus < 500) return false
          return count < 1
        },
      },
      mutations: { retry: false },
    },
  })
}

export function Providers({ children }: { children: ReactNode }) {
  // useState 로 만들어야 리렌더링마다 QueryClient 가 새로 생기지 않아요.
  const [client] = useState(makeQueryClient)

  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster />
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  )
}
