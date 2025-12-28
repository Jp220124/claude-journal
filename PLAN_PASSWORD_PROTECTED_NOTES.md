# Password-Protected Notes Feature - Implementation Plan

## Overview
Allow users to set individual passwords on specific notes for additional privacy. When a note is locked, users must enter the correct password to view or edit its content.

---

## Analysis Summary

### User Request
"I was thinking that we can put password in the Notes like if we want put Password on a specific Notes we can do it"

### Core Requirements
1. Users can optionally lock any note with a password
2. Locked notes require password entry to view/edit
3. Each note has its own independent password
4. Password protection is additional layer (separate from main auth)

---

## Architecture Decision

**Approach: UI Gating (Recommended for MVP)**
- Store password hash in database
- Content remains in plain text in DB (protected by RLS)
- Password gates UI access to note content
- Can upgrade to full encryption later if needed

**Why UI Gating over Full Encryption:**
- Simpler implementation
- Search still works on locked notes (title visible)
- Password recovery not needed (but content not lost if forgotten - admin can help)
- Content already protected by Supabase RLS from other users

---

## Database Schema Changes

### Migration: `015_add_note_password_protection.sql`

```sql
-- Add password protection columns to notes table
ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- Create index for quick filtering
CREATE INDEX IF NOT EXISTS idx_notes_is_locked ON notes(is_locked) WHERE is_locked = true;
```

### TypeScript Type Updates (`src/types/database.ts`)

```typescript
// Update Note interface
export interface Note {
  // ... existing fields
  is_locked: boolean
  password_hash?: string | null
  locked_at?: string | null
}

// Update NoteUpdate interface
export interface NoteUpdate {
  // ... existing fields
  is_locked?: boolean
  password_hash?: string | null
  locked_at?: string | null
}
```

---

## API Routes

### 1. Lock Note: `POST /api/notes/[id]/lock`
```typescript
// Request: { password: string }
// Response: { success: boolean, note: Note }
// Flow:
// 1. Validate password strength (min 4 chars)
// 2. Hash password with bcryptjs (cost 12)
// 3. Update note: is_locked=true, password_hash=hash, locked_at=now
// 4. Return updated note
```

### 2. Unlock Note: `POST /api/notes/[id]/unlock`
```typescript
// Request: { password: string }
// Response: { success: boolean, note?: Note }
// Flow:
// 1. Fetch note's password_hash
// 2. Compare with bcrypt
// 3. If match: return note content
// 4. If no match: return error
```

### 3. Remove Lock: `POST /api/notes/[id]/remove-lock`
```typescript
// Request: {} (note must already be unlocked in session)
// Response: { success: boolean }
// Flow:
// 1. Verify note is unlocked in current session
// 2. Clear is_locked, password_hash, locked_at
// 3. Return success
```

---

## Frontend Components

### 1. LockNoteModal (`src/components/notes/LockNoteModal.tsx`)
- Password input with visibility toggle
- Confirm password field
- Password strength indicator (optional)
- Warning: "If you forget this password, content will be inaccessible"
- Save/Cancel buttons

### 2. UnlockNoteModal (`src/components/notes/UnlockNoteModal.tsx`)
- Password input field
- Error message on wrong password
- "Unlock" button
- Optional: "Stay unlocked for this session" checkbox

### 3. Lock Indicator Updates
- **Note Card**: Lock icon overlay on locked notes
- **Editor Toolbar**: Lock/Unlock button
- **Sidebar**: Show lock icon next to locked notes

---

## State Management

### Session Unlock Tracking
```typescript
// src/contexts/LockedNotesContext.tsx
interface LockedNotesContextType {
  unlockedNoteIds: Set<string>
  unlockNote: (noteId: string) => void
  lockNote: (noteId: string) => void
  isNoteUnlocked: (noteId: string) => boolean
  clearAllUnlocks: () => void
}
```

- Track which locked notes have been unlocked this session
- Clear on logout/tab close
- Persist in sessionStorage (not localStorage)

---

## Service Functions

### Add to `src/lib/notesService.ts`

```typescript
// Lock a note with password
export async function lockNote(noteId: string, password: string): Promise<Note | null>

// Verify password and unlock note for session
export async function verifyNotePassword(noteId: string, password: string): Promise<boolean>

// Remove password protection from note
export async function removeLockFromNote(noteId: string): Promise<Note | null>

// Check if note is locked (without fetching content)
export async function isNoteLocked(noteId: string): Promise<boolean>
```

---

## UI/UX Flow

### Locking a Note
1. User opens note they want to protect
2. Clicks "Lock" button in toolbar
3. LockNoteModal appears
4. User enters password + confirmation
5. Shows warning about password recovery
6. User confirms -> Note is locked
7. Lock icon appears, note stays open (unlocked for session)

### Viewing a Locked Note
1. User clicks on a locked note (shows lock icon)
2. UnlockNoteModal appears
3. User enters password
4. If correct: Note opens, added to session unlocked set
5. If wrong: Error message, stays locked

### Removing Lock
1. Note must be unlocked in current session
2. User clicks "Remove Lock" in toolbar
3. Confirmation dialog appears
4. User confirms -> Lock removed permanently

---

## Search Behavior

- Locked notes appear in search results
- Show: Title + lock icon
- Hide: Content preview (show "This note is locked")
- User must unlock to see full content

---

## Files to Create/Modify

### New Files
1. `supabase/migrations/015_add_note_password_protection.sql`
2. `src/app/api/notes/[id]/lock/route.ts`
3. `src/app/api/notes/[id]/unlock/route.ts`
4. `src/app/api/notes/[id]/remove-lock/route.ts`
5. `src/components/notes/LockNoteModal.tsx`
6. `src/components/notes/UnlockNoteModal.tsx`
7. `src/contexts/LockedNotesContext.tsx`

### Modified Files
1. `src/types/database.ts` - Add lock fields to Note type
2. `src/lib/notesService.ts` - Add lock/unlock functions
3. `src/components/notes/EditorToolbar.tsx` - Add lock button
4. `src/components/notes/NotesEditor.tsx` - Handle locked state
5. `src/components/notes/NotesSidebarComponents.tsx` - Show lock icons
6. `src/app/(dashboard)/notes/page.tsx` - Wrap with context provider

---

## Dependencies

```bash
npm install bcryptjs
npm install --save-dev @types/bcryptjs
```

---

## Implementation Order

### Phase 1: Backend (Day 1)
1. Create database migration
2. Update TypeScript types
3. Create API routes with bcrypt hashing
4. Test API endpoints

### Phase 2: Frontend Components (Day 2)
5. Create LockedNotesContext
6. Create LockNoteModal
7. Create UnlockNoteModal
8. Add service functions

### Phase 3: Integration (Day 3)
9. Add lock button to EditorToolbar
10. Update NotesEditor to handle locked state
11. Update sidebar to show lock icons
12. Handle search results for locked notes

### Phase 4: Testing & Polish
13. Test all lock/unlock flows
14. Test session persistence
15. Test edge cases (logout, tab close)
16. UI polish and error handling

---

## Security Notes

1. **Never store plain passwords** - Always hash with bcrypt
2. **Hash on server** - API routes handle hashing, not client
3. **No password hints** - Security risk
4. **Rate limiting** - Consider adding attempt limits
5. **Clear session on logout** - Unlocked notes cleared when user logs out
6. **RLS still applies** - Users can only lock their own notes

---

## Future Enhancements (Not in MVP)

1. Full content encryption with password-derived key
2. Biometric unlock on mobile
3. Master password to unlock all notes
4. Password recovery via email verification
5. Auto-lock after inactivity timeout
