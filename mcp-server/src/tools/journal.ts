import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId } from '../lib/supabase.js';
import { JournalEntry, DailyEntry, createJsonResult, createErrorResult, createTextResult } from '../lib/types.js';

export function registerJournalTools(server: McpServer) {
  const userId = getUserId();

  // =====================================================
  // Get Today's Journal Entry
  // =====================================================
  server.tool(
    'get_today_journal',
    'Get today\'s journal entry',
    {},
    async () => {
      try {
        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('journal_entries')
          .select('*')
          .eq('user_id', userId)
          .eq('date', today)
          .single();

        if (error && error.code !== 'PGRST116') {
          return createErrorResult(error.message);
        }

        if (!data) {
          return createTextResult(`No journal entry for today (${today}). Use create_journal_entry to create one.`);
        }

        return createJsonResult(data as JournalEntry);
      } catch (err) {
        return createErrorResult(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  );

  // =====================================================
  // Read Journal Entry
  // =====================================================
  server.tool(
    'read_journal_entry',
    'Read a journal entry for a specific date',
    {
      date: z.string().describe('Date in YYYY-MM-DD format'),
    },
    async ({ date }) => {
      try {
        const { data, error } = await supabase
          .from('journal_entries')
          .select('*')
          .eq('user_id', userId)
          .eq('date', date)
          .single();

        if (error && error.code !== 'PGRST116') {
          return createErrorResult(error.message);
        }

        if (!data) {
          return createTextResult(`No journal entry for ${date}`);
        }

        return createJsonResult(data as JournalEntry);
      } catch (err) {
        return createErrorResult(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  );

  // =====================================================
  // Create Journal Entry
  // =====================================================
  server.tool(
    'create_journal_entry',
    'Create a new journal entry for today or a specific date',
    {
      date: z.string().optional().describe('Date in YYYY-MM-DD format (defaults to today)'),
      title: z.string().optional().describe('Title for the entry'),
      content: z.string().describe('Content of the journal entry'),
      mood: z.string().optional().describe('Mood for the day (e.g., great, good, okay, bad)'),
      tags: z.array(z.string()).optional().describe('Tags for the entry'),
    },
    async ({ date, title, content, mood, tags }) => {
      try {
        const entryDate = date || new Date().toISOString().split('T')[0];

        // Check if entry already exists
        const { data: existing } = await supabase
          .from('journal_entries')
          .select('id')
          .eq('user_id', userId)
          .eq('date', entryDate)
          .single();

        if (existing) {
          return createErrorResult(`Journal entry for ${entryDate} already exists. Use update_journal_entry to modify it.`);
        }

        const { data, error } = await supabase
          .from('journal_entries')
          .insert({
            user_id: userId,
            date: entryDate,
            title: title || null,
            content,
            mood: mood || null,
            tags: tags || null,
          })
          .select('id, date, title')
          .single();

        if (error) {
          return createErrorResult(error.message);
        }

        return createJsonResult({
          success: true,
          message: `Journal entry for ${entryDate} created successfully`,
          entry: data,
        });
      } catch (err) {
        return createErrorResult(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  );

  // =====================================================
  // Update Journal Entry
  // =====================================================
  server.tool(
    'update_journal_entry',
    'Update an existing journal entry',
    {
      date: z.string().describe('Date of the entry to update (YYYY-MM-DD)'),
      title: z.string().optional().describe('New title'),
      content: z.string().optional().describe('New content (replaces existing)'),
      append_content: z.string().optional().describe('Content to append to existing'),
      mood: z.string().optional().describe('New mood'),
      tags: z.array(z.string()).optional().describe('New tags (replaces existing)'),
    },
    async ({ date, title, content, append_content, mood, tags }) => {
      try {
        // Get existing entry
        const { data: existing, error: checkError } = await supabase
          .from('journal_entries')
          .select('*')
          .eq('user_id', userId)
          .eq('date', date)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          return createErrorResult(checkError.message);
        }

        if (!existing) {
          return createErrorResult(`No journal entry for ${date}. Use create_journal_entry first.`);
        }

        const entry = existing as JournalEntry;
        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (title !== undefined) updates.title = title;
        if (mood !== undefined) updates.mood = mood;
        if (tags !== undefined) updates.tags = tags;

        if (content !== undefined) {
          updates.content = content;
        } else if (append_content !== undefined) {
          updates.content = (entry.content || '') + '\n\n' + append_content;
        }

        const { error } = await supabase
          .from('journal_entries')
          .update(updates)
          .eq('user_id', userId)
          .eq('date', date);

        if (error) {
          return createErrorResult(error.message);
        }

        return createTextResult(`Journal entry for ${date} updated successfully`);
      } catch (err) {
        return createErrorResult(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  );

  // =====================================================
  // List Recent Journal Entries
  // =====================================================
  server.tool(
    'list_journal_entries',
    'List recent journal entries',
    {
      days: z.number().default(7).describe('Number of days to look back'),
      limit: z.number().default(10).describe('Maximum number of entries'),
    },
    async ({ days, limit }) => {
      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('journal_entries')
          .select('id, date, title, mood, tags, created_at')
          .eq('user_id', userId)
          .gte('date', startDateStr)
          .order('date', { ascending: false })
          .limit(limit);

        if (error) {
          return createErrorResult(error.message);
        }

        return createJsonResult({
          count: (data as JournalEntry[]).length,
          entries: data,
        });
      } catch (err) {
        return createErrorResult(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  );

  // =====================================================
  // Search Journal Entries
  // =====================================================
  server.tool(
    'search_journal',
    'Search journal entries by content',
    {
      query: z.string().describe('Search query'),
      limit: z.number().default(10).describe('Maximum number of results'),
    },
    async ({ query, limit }) => {
      try {
        const { data, error } = await supabase
          .from('journal_entries')
          .select('id, date, title, content, mood')
          .eq('user_id', userId)
          .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
          .order('date', { ascending: false })
          .limit(limit);

        if (error) {
          return createErrorResult(error.message);
        }

        const entries = (data as JournalEntry[]).map(entry => ({
          id: entry.id,
          date: entry.date,
          title: entry.title,
          preview: entry.content?.slice(0, 200) || '',
          mood: entry.mood,
        }));

        return createJsonResult({
          query,
          count: entries.length,
          entries,
        });
      } catch (err) {
        return createErrorResult(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  );

  // =====================================================
  // Get Journal Statistics
  // =====================================================
  server.tool(
    'get_journal_stats',
    'Get statistics about journal entries',
    {},
    async () => {
      try {
        const { data, error } = await supabase
          .from('journal_entries')
          .select('id, date, mood, content')
          .eq('user_id', userId);

        if (error) {
          return createErrorResult(error.message);
        }

        const entries = data as JournalEntry[];

        // Calculate statistics
        const totalEntries = entries.length;
        const totalWords = entries.reduce((sum, entry) => {
          const words = entry.content?.split(/\s+/).filter(Boolean).length || 0;
          return sum + words;
        }, 0);

        // Mood distribution
        const moodCounts: Record<string, number> = {};
        entries.forEach(entry => {
          if (entry.mood) {
            moodCounts[entry.mood] = (moodCounts[entry.mood] || 0) + 1;
          }
        });

        // Calculate streak
        const dates = entries.map(e => e.date).sort().reverse();
        let streak = 0;
        const today = new Date();
        for (let i = 0; i < 365; i++) {
          const checkDate = new Date(today);
          checkDate.setDate(checkDate.getDate() - i);
          const dateStr = checkDate.toISOString().split('T')[0];
          if (dates.includes(dateStr)) {
            streak++;
          } else if (i > 0) {
            break;
          }
        }

        return createJsonResult({
          total_entries: totalEntries,
          total_words: totalWords,
          average_words: totalEntries > 0 ? Math.round(totalWords / totalEntries) : 0,
          current_streak: streak,
          mood_distribution: moodCounts,
          first_entry: dates[dates.length - 1] || null,
          last_entry: dates[0] || null,
        });
      } catch (err) {
        return createErrorResult(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  );

  // =====================================================
  // Delete Journal Entry
  // =====================================================
  server.tool(
    'delete_journal_entry',
    'Delete a journal entry',
    {
      date: z.string().describe('Date of the entry to delete (YYYY-MM-DD)'),
    },
    async ({ date }) => {
      try {
        const { data: existing, error: checkError } = await supabase
          .from('journal_entries')
          .select('id')
          .eq('user_id', userId)
          .eq('date', date)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          return createErrorResult(checkError.message);
        }

        if (!existing) {
          return createErrorResult(`No journal entry for ${date}`);
        }

        const { error } = await supabase
          .from('journal_entries')
          .delete()
          .eq('user_id', userId)
          .eq('date', date);

        if (error) {
          return createErrorResult(error.message);
        }

        return createTextResult(`Journal entry for ${date} deleted`);
      } catch (err) {
        return createErrorResult(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  );
}
