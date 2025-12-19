'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { MoodSelector } from './MoodSelector'
import { TaskItem } from './TaskItem'
import { RichTextEditor } from './RichTextEditor'
import { Plus, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { SectionEntry, TaskInstance } from '@/types/database'
import { useJournalStore } from '@/stores/journalStore'
import { useDebouncedCallback } from '@/hooks/useDebounce'

interface SectionCardProps {
  section: SectionEntry & { task_instances: TaskInstance[] }
}

export function SectionCard({ section }: SectionCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [showAddTask, setShowAddTask] = useState(false)

  const { updateSectionContent, updateSectionMood, toggleTask, addCustomTask } = useJournalStore()

  const completedTasks = section.task_instances.filter((t) => t.is_completed).length
  const totalTasks = section.task_instances.length

  const debouncedUpdateContent = useDebouncedCallback(
    (content: string) => {
      updateSectionContent(section.id, content)
    },
    500
  )

  const handleContentChange = useCallback(
    (content: string) => {
      debouncedUpdateContent(content)
    },
    [debouncedUpdateContent]
  )

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return

    await addCustomTask(section.id, newTaskTitle.trim())
    setNewTaskTitle('')
    setShowAddTask(false)
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader
        className="cursor-pointer py-4"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{section.section_icon || '📝'}</span>
            <div>
              <h3
                className="font-semibold text-lg"
                style={{ color: section.section_color || 'inherit' }}
              >
                {section.section_name}
              </h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                {completedTasks}/{totalTasks} tasks completed
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div onClick={(e) => e.stopPropagation()}>
              <MoodSelector
                value={section.mood}
                onChange={(mood) => updateSectionMood(section.id, mood)}
                size="sm"
              />
            </div>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-[var(--muted-foreground)]" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[var(--muted-foreground)]" />
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          {/* Tasks */}
          <div className="space-y-1">
            {section.task_instances.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={toggleTask}
              />
            ))}

            {/* Add task */}
            {showAddTask ? (
              <div className="flex items-center gap-2 pt-2">
                <Input
                  placeholder="New task..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddTask()
                    if (e.key === 'Escape') setShowAddTask(false)
                  }}
                  className="h-8"
                  autoFocus
                />
                <Button size="sm" onClick={handleAddTask}>
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowAddTask(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddTask(true)}
                className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] py-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add task
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-[var(--border)]" />

          {/* Journal entry */}
          <div>
            <p className="text-sm font-medium text-[var(--muted-foreground)] mb-2">
              Journal Entry
            </p>
            <RichTextEditor
              content={section.content || ''}
              onChange={handleContentChange}
              placeholder={`How was your ${section.section_name?.toLowerCase()}?`}
            />
          </div>
        </CardContent>
      )}
    </Card>
  )
}
