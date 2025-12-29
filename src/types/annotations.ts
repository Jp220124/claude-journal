/**
 * Types for Note Annotations (Sticky Notes)
 */

// Database row type matching Supabase table
export interface NoteAnnotation {
  id: string
  note_id: string
  user_id: string
  anchor_id: string
  anchor_text: string | null
  content: string
  color: string
  position_x: number
  position_y: number
  created_at: string
  updated_at: string
}

// Type for creating a new annotation
export interface CreateAnnotationInput {
  note_id: string
  anchor_id: string
  anchor_text?: string
  content?: string
  color?: string
  position_x?: number
  position_y?: number
}

// Type for updating an annotation
export interface UpdateAnnotationInput {
  content?: string
  color?: string
  position_x?: number
  position_y?: number
}

// Position of an anchor element in the DOM
export interface AnchorPosition {
  top: number
  left: number
  right: number
  bottom: number
  width: number
  height: number
}

// Sticky note state for UI
export interface StickyNoteState {
  annotation: NoteAnnotation
  anchorPosition: AnchorPosition | null
  isDragging: boolean
  isEditing: boolean
}

// Connection line coordinates
export interface ConnectionLineCoords {
  startX: number
  startY: number
  endX: number
  endY: number
}

// Available sticky note colors
export const STICKY_NOTE_COLORS = {
  yellow: '#FEF3C7',
  pink: '#FCE7F3',
  blue: '#DBEAFE',
  green: '#D1FAE5',
  purple: '#EDE9FE',
  orange: '#FFEDD5',
} as const

export type StickyNoteColor = typeof STICKY_NOTE_COLORS[keyof typeof STICKY_NOTE_COLORS]

// TipTap mark attributes
export interface StickyAnchorAttributes {
  'data-sticky-anchor-id': string
  class: string
}
