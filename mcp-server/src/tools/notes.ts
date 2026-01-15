import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId } from '../lib/supabase.js';
import { Note, NoteFolder, createJsonResult, createErrorResult, createTextResult } from '../lib/types.js';

export function registerNoteTools(server: McpServer) {
  const userId = getUserId();

  // =====================================================
  // List Notes
  // =====================================================
  server.tool(
    'list_notes',
    'List all notes in the journal with optional filtering',
    {
      folder_id: z.string().optional().describe('Filter by folder ID'),
      include_archived: z.boolean().default(false).describe('Include archived notes'),
      limit: z.number().default(20).describe('Maximum number of notes to return'),
      offset: z.number().default(0).describe('Offset for pagination'),
    },
    async ({ folder_id, include_archived, limit, offset }) => {
      try {
        let query = supabase
          .from('notes')
          .select('id, title, content_text, folder_id, is_pinned, is_archived, word_count, created_at, updated_at, is_locked')
          .eq('user_id', userId)
          .order('is_pinned', { ascending: false })
          .order('updated_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (folder_id) {
          query = query.eq('folder_id', folder_id);
        }

        if (!include_archived) {
          query = query.eq('is_archived', false);
        }

        const { data, error } = await query;

        if (error) {
          return createErrorResult(error.message);
        }

        const notes = (data as Note[]).map(note => ({
          id: note.id,
          title: note.title,
          preview: note.content_text?.slice(0, 200) || '',
          folder_id: note.folder_id,
          is_pinned: note.is_pinned,
          is_archived: note.is_archived,
          is_locked: note.is_locked,
          word_count: note.word_count,
          updated_at: note.updated_at,
        }));

        return createJsonResult({
          count: notes.length,
          notes,
        });
      } catch (err) {
        return createErrorResult(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  );

  // =====================================================
  // Read Note
  // =====================================================
  server.tool(
    'read_note',
    'Read the full content of a note by ID',
    {
      note_id: z.string().describe('The ID of the note to read'),
    },
    async ({ note_id }) => {
      try {
        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .eq('id', note_id)
          .eq('user_id', userId)
          .single();

        if (error) {
          return createErrorResult(error.message);
        }

        if (!data) {
          return createErrorResult('Note not found');
        }

        const note = data as Note;

        if (note.is_locked) {
          return createTextResult(`Note "${note.title}" is password protected. Content cannot be accessed via MCP.`);
        }

        return createJsonResult({
          id: note.id,
          title: note.title,
          content_text: note.content_text,
          folder_id: note.folder_id,
          is_pinned: note.is_pinned,
          is_archived: note.is_archived,
          word_count: note.word_count,
          created_at: note.created_at,
          updated_at: note.updated_at,
        });
      } catch (err) {
        return createErrorResult(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  );

  // =====================================================
  // Create Note
  // =====================================================
  server.tool(
    'create_note',
    'Create a new note in the journal',
    {
      title: z.string().describe('Title of the note'),
      content: z.string().describe('Content of the note in plain text'),
      folder_id: z.string().optional().describe('Folder ID to place the note in'),
    },
    async ({ title, content, folder_id }) => {
      try {
        // Create TipTap-compatible JSON content
        const tiptapContent = {
          type: 'doc',
          content: content.split('\n\n').map(paragraph => ({
            type: 'paragraph',
            content: paragraph ? [{ type: 'text', text: paragraph }] : [],
          })),
        };

        const { data, error } = await supabase
          .from('notes')
          .insert({
            user_id: userId,
            title,
            content: tiptapContent,
            content_text: content,
            folder_id: folder_id || null,
            is_pinned: false,
            is_archived: false,
            word_count: content.split(/\s+/).filter(Boolean).length,
          })
          .select('id, title, created_at')
          .single();

        if (error) {
          return createErrorResult(error.message);
        }

        return createJsonResult({
          success: true,
          message: `Note "${title}" created successfully`,
          note: data,
        });
      } catch (err) {
        return createErrorResult(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  );

  // =====================================================
  // Update Note
  // =====================================================
  server.tool(
    'update_note',
    'Update an existing note',
    {
      note_id: z.string().describe('The ID of the note to update'),
      title: z.string().optional().describe('New title for the note'),
      content: z.string().optional().describe('New content for the note'),
      folder_id: z.string().optional().describe('New folder ID'),
      is_pinned: z.boolean().optional().describe('Pin or unpin the note'),
      is_archived: z.boolean().optional().describe('Archive or unarchive the note'),
    },
    async ({ note_id, title, content, folder_id, is_pinned, is_archived }) => {
      try {
        // First check if note exists and belongs to user
        const { data: existingNote, error: checkError } = await supabase
          .from('notes')
          .select('id, is_locked')
          .eq('id', note_id)
          .eq('user_id', userId)
          .single();

        if (checkError || !existingNote) {
          return createErrorResult('Note not found');
        }

        if ((existingNote as Note).is_locked) {
          return createErrorResult('Cannot update a password-protected note via MCP');
        }

        // Build update object
        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (title !== undefined) updates.title = title;
        if (folder_id !== undefined) updates.folder_id = folder_id;
        if (is_pinned !== undefined) updates.is_pinned = is_pinned;
        if (is_archived !== undefined) updates.is_archived = is_archived;

        if (content !== undefined) {
          updates.content_text = content;
          updates.content = {
            type: 'doc',
            content: content.split('\n\n').map(paragraph => ({
              type: 'paragraph',
              content: paragraph ? [{ type: 'text', text: paragraph }] : [],
            })),
          };
          updates.word_count = content.split(/\s+/).filter(Boolean).length;
        }

        const { data, error } = await supabase
          .from('notes')
          .update(updates)
          .eq('id', note_id)
          .eq('user_id', userId)
          .select('id, title, updated_at')
          .single();

        if (error) {
          return createErrorResult(error.message);
        }

        return createJsonResult({
          success: true,
          message: 'Note updated successfully',
          note: data,
        });
      } catch (err) {
        return createErrorResult(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  );

  // =====================================================
  // Delete Note
  // =====================================================
  server.tool(
    'delete_note',
    'Delete a note (moves to archive first, or permanently deletes if already archived)',
    {
      note_id: z.string().describe('The ID of the note to delete'),
      permanent: z.boolean().default(false).describe('Permanently delete instead of archiving'),
    },
    async ({ note_id, permanent }) => {
      try {
        // Check if note exists
        const { data: existingNote, error: checkError } = await supabase
          .from('notes')
          .select('id, title, is_archived, is_locked')
          .eq('id', note_id)
          .eq('user_id', userId)
          .single();

        if (checkError || !existingNote) {
          return createErrorResult('Note not found');
        }

        const note = existingNote as Note & { title: string };

        if (note.is_locked) {
          return createErrorResult('Cannot delete a password-protected note via MCP');
        }

        if (permanent) {
          // Permanently delete
          const { error } = await supabase
            .from('notes')
            .delete()
            .eq('id', note_id)
            .eq('user_id', userId);

          if (error) {
            return createErrorResult(error.message);
          }

          return createTextResult(`Note "${note.title}" permanently deleted`);
        } else {
          // Archive instead of delete
          const { error } = await supabase
            .from('notes')
            .update({ is_archived: true, updated_at: new Date().toISOString() })
            .eq('id', note_id)
            .eq('user_id', userId);

          if (error) {
            return createErrorResult(error.message);
          }

          return createTextResult(`Note "${note.title}" moved to archive`);
        }
      } catch (err) {
        return createErrorResult(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  );

  // =====================================================
  // Search Notes
  // =====================================================
  server.tool(
    'search_notes',
    'Search notes by content or title',
    {
      query: z.string().describe('Search query'),
      include_archived: z.boolean().default(false).describe('Include archived notes'),
      limit: z.number().default(10).describe('Maximum number of results'),
    },
    async ({ query, include_archived, limit }) => {
      try {
        let dbQuery = supabase
          .from('notes')
          .select('id, title, content_text, folder_id, is_pinned, is_archived, updated_at, is_locked')
          .eq('user_id', userId)
          .or(`title.ilike.%${query}%,content_text.ilike.%${query}%`)
          .order('updated_at', { ascending: false })
          .limit(limit);

        if (!include_archived) {
          dbQuery = dbQuery.eq('is_archived', false);
        }

        const { data, error } = await dbQuery;

        if (error) {
          return createErrorResult(error.message);
        }

        const notes = (data as Note[]).map(note => ({
          id: note.id,
          title: note.title,
          preview: note.content_text?.slice(0, 200) || '',
          folder_id: note.folder_id,
          is_pinned: note.is_pinned,
          is_locked: note.is_locked,
          updated_at: note.updated_at,
        }));

        return createJsonResult({
          query,
          count: notes.length,
          notes,
        });
      } catch (err) {
        return createErrorResult(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  );

  // =====================================================
  // List Folders
  // =====================================================
  server.tool(
    'list_folders',
    'List all note folders',
    {},
    async () => {
      try {
        const { data, error } = await supabase
          .from('note_folders')
          .select('id, name, icon, color, parent_folder_id, order_index')
          .eq('user_id', userId)
          .order('order_index', { ascending: true });

        if (error) {
          return createErrorResult(error.message);
        }

        return createJsonResult({
          count: (data as NoteFolder[]).length,
          folders: data,
        });
      } catch (err) {
        return createErrorResult(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  );

  // =====================================================
  // Create Folder
  // =====================================================
  server.tool(
    'create_folder',
    'Create a new folder for notes',
    {
      name: z.string().describe('Name of the folder'),
      icon: z.string().default('folder').describe('Icon for the folder'),
      color: z.string().default('#6366f1').describe('Color for the folder'),
      parent_folder_id: z.string().optional().describe('Parent folder ID for nested folders'),
    },
    async ({ name, icon, color, parent_folder_id }) => {
      try {
        const { data, error } = await supabase
          .from('note_folders')
          .insert({
            user_id: userId,
            name,
            icon,
            color,
            parent_folder_id: parent_folder_id || null,
            order_index: 0,
          })
          .select('id, name')
          .single();

        if (error) {
          return createErrorResult(error.message);
        }

        return createJsonResult({
          success: true,
          message: `Folder "${name}" created successfully`,
          folder: data,
        });
      } catch (err) {
        return createErrorResult(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  );
}
