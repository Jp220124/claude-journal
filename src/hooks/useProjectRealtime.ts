'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { ProjectLinkedTask, ProjectLinkedNote, ProjectFile, CalendarEvent } from '@/types/projects'

// =====================================================
// Types for Realtime Events
// =====================================================

type ChangeEventType = 'INSERT' | 'UPDATE' | 'DELETE'

interface RealtimeChange<T = unknown> {
  eventType: ChangeEventType
  table: string
  old: T | null
  new: T | null
}

interface ProjectRealtimeState {
  isConnected: boolean
  error: string | null
  lastUpdate: Date | null
}

interface ProjectRealtimeCallbacks {
  onTaskChange?: (change: RealtimeChange<ProjectLinkedTask>) => void
  onNoteChange?: (change: RealtimeChange<ProjectLinkedNote>) => void
  onFileChange?: (change: RealtimeChange<ProjectFile>) => void
  onEventChange?: (change: RealtimeChange<CalendarEvent>) => void
  onMemberChange?: (change: RealtimeChange) => void
  onAnyChange?: () => void
}

// =====================================================
// useProjectRealtime Hook
// =====================================================

/**
 * Subscribe to real-time changes for a specific project
 * Handles tasks, notes, files, events, and members
 */
export function useProjectRealtime(
  projectId: string | null,
  callbacks: ProjectRealtimeCallbacks = {}
) {
  const [state, setState] = useState<ProjectRealtimeState>({
    isConnected: false,
    error: null,
    lastUpdate: null,
  })

  const channelRef = useRef<RealtimeChannel | null>(null)
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  const handleChange = useCallback((
    table: string,
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>
  ) => {
    const change: RealtimeChange = {
      eventType: payload.eventType as ChangeEventType,
      table,
      old: payload.old as Record<string, unknown> | null,
      new: payload.new as Record<string, unknown> | null,
    }

    setState(prev => ({ ...prev, lastUpdate: new Date() }))

    // Call specific callback based on table
    switch (table) {
      case 'project_tasks':
        callbacksRef.current.onTaskChange?.(change as RealtimeChange<ProjectLinkedTask>)
        break
      case 'project_notes':
        callbacksRef.current.onNoteChange?.(change as RealtimeChange<ProjectLinkedNote>)
        break
      case 'project_files':
        callbacksRef.current.onFileChange?.(change as RealtimeChange<ProjectFile>)
        break
      case 'project_events':
        callbacksRef.current.onEventChange?.(change as RealtimeChange<CalendarEvent>)
        break
      case 'project_members':
        callbacksRef.current.onMemberChange?.(change)
        break
    }

    // Always call the generic callback
    callbacksRef.current.onAnyChange?.()
  }, [])

  useEffect(() => {
    if (!projectId) {
      setState(prev => ({ ...prev, isConnected: false }))
      return
    }

    const supabase = createClient()

    // Create a unique channel name for this project
    const channelName = `project-realtime-${projectId}`

    // Unsubscribe from previous channel if exists
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    // Create new channel with subscriptions to all related tables
    const channel = supabase
      .channel(channelName)
      // Subscribe to project_tasks changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_tasks',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => handleChange('project_tasks', payload)
      )
      // Subscribe to project_notes changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_notes',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => handleChange('project_notes', payload)
      )
      // Subscribe to project_files changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_files',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => handleChange('project_files', payload)
      )
      // Subscribe to project_events changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_events',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => handleChange('project_events', payload)
      )
      // Subscribe to project_members changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_members',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => handleChange('project_members', payload)
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setState(prev => ({ ...prev, isConnected: true, error: null }))
        } else if (status === 'CHANNEL_ERROR') {
          setState(prev => ({
            ...prev,
            isConnected: false,
            error: 'Failed to connect to real-time updates',
          }))
        } else if (status === 'TIMED_OUT') {
          setState(prev => ({
            ...prev,
            isConnected: false,
            error: 'Connection timed out',
          }))
        }
      })

    channelRef.current = channel

    // Cleanup on unmount or project change
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      setState(prev => ({ ...prev, isConnected: false }))
    }
  }, [projectId, handleChange])

  return state
}

// =====================================================
// useProjectRealtimeData Hook
// =====================================================

/**
 * Higher-level hook that combines realtime subscriptions with data fetching
 * Automatically refetches data when changes are detected
 */
export function useProjectRealtimeData<T>(
  projectId: string | null,
  fetchData: () => Promise<T>,
  options: {
    initialData?: T
    debounceMs?: number
  } = {}
) {
  const { initialData, debounceMs = 100 } = options

  const [data, setData] = useState<T | undefined>(initialData)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const refetch = useCallback(async () => {
    try {
      setError(null)
      const result = await fetchData()
      setData(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch data'
      setError(message)
      console.error('Error fetching project data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [fetchData])

  // Debounced refetch for realtime updates
  const debouncedRefetch = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      refetch()
    }, debounceMs)
  }, [refetch, debounceMs])

  // Subscribe to realtime changes
  const realtimeState = useProjectRealtime(projectId, {
    onAnyChange: debouncedRefetch,
  })

  // Initial fetch
  useEffect(() => {
    if (projectId) {
      setIsLoading(true)
      refetch()
    }
  }, [projectId, refetch])

  // Cleanup debounce timeout
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return {
    data,
    isLoading,
    error,
    refetch,
    isConnected: realtimeState.isConnected,
    lastUpdate: realtimeState.lastUpdate,
    realtimeError: realtimeState.error,
  }
}

// =====================================================
// useCollaboratorPresence Hook (Optional)
// =====================================================

interface CollaboratorPresence {
  id: string
  email?: string
  name?: string
  lastSeen: Date
  isOnline: boolean
}

/**
 * Track which collaborators are currently viewing the project
 * Uses Supabase Presence feature
 */
export function useCollaboratorPresence(projectId: string | null) {
  const [collaborators, setCollaborators] = useState<CollaboratorPresence[]>([])
  const [isConnected, setIsConnected] = useState(false)

  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!projectId) return

    const supabase = createClient()
    const channelName = `project-presence-${projectId}`

    // Get current user
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return

      const channel = supabase.channel(channelName, {
        config: { presence: { key: user.id } },
      })

      // Track presence changes
      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState()
          const presences: CollaboratorPresence[] = []

          Object.entries(state).forEach(([userId, data]) => {
            const presence = (data as { email?: string; name?: string }[])[0]
            presences.push({
              id: userId,
              email: presence?.email,
              name: presence?.name,
              lastSeen: new Date(),
              isOnline: true,
            })
          })

          setCollaborators(presences)
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          console.log('User joined:', key, newPresences)
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          console.log('User left:', key)
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            setIsConnected(true)
            // Track our own presence
            await channel.track({
              email: user.email,
              name: user.user_metadata?.full_name,
            })
          }
        })

      channelRef.current = channel
    })

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      setIsConnected(false)
      setCollaborators([])
    }
  }, [projectId])

  return { collaborators, isConnected }
}
