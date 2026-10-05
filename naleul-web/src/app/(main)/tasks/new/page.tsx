import type { Metadata } from 'next'
import { TaskAddView } from '@/features/brain-dump/ui/TaskAddView'

export const metadata: Metadata = { title: 'Task 추가' }

export default function TaskAddPage() {
  return <TaskAddView />
}
