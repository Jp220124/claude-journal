/**
 * Time Block Service for Telegram Bot
 * Handles recurring time blocks with daily recurrence support
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../config/env.js';

// Create Supabase client with service role key
const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// =====================================================
// Types
// =====================================================

export type TimeBlockType = 'task' | 'focus' | 'break' | 'meeting' | 'personal';

export interface RecurrencePattern {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  daysOfWeek?: number[];
  endDate?: string;
  occurrences?: number;
}

export interface TimeBlock {
  id: string;
  user_id: string;
  todo_id: string | null;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  color: string;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  buffer_minutes: number;
  block_type: TimeBlockType;
  energy_level: 'high' | 'medium' | 'low' | null;
  completed_at: string | null;
  parent_block_id: string | null;
  is_template: boolean;
  instance_date: string | null;
  reminder_minutes_before: number;
  reminder_sent: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRecurringBlockParams {
  userId: string;
  title: string;
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  blockType?: TimeBlockType;
  color?: string;
  description?: string;
  reminderMinutesBefore?: number;
  endDate?: string; // ISO date for recurrence end
}

// Block colors by type
const BLOCK_COLORS: Record<TimeBlockType, string> = {
  task: '#06b6d4',
  focus: '#3b82f6',
  break: '#22c55e',
  meeting: '#8b5cf6',
  personal: '#f59e0b',
};

// =====================================================
// Helper Functions
// =====================================================

/**
 * Parse time string (HH:MM) to hours and minutes
 */
function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

/**
 * Format time for display
 */
export function formatTime(timeStr: string): string {
  const { hours, minutes } = parseTime(timeStr);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${period}`;
}

/**
 * Get today's date in ISO format
 */
function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get date N days from now
 */
function getDateFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

/**
 * Create a datetime from date and time components
 */
function createDateTime(dateStr: string, timeStr: string): string {
  const { hours, minutes } = parseTime(timeStr);
  const date = new Date(dateStr + 'T00:00:00');
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

// =====================================================
// Core Service Functions
// =====================================================

/**
 * Create a recurring daily time block
 * Creates a template and generates instances for the next 30 days
 */
export async function createRecurringDailyBlock(
  params: CreateRecurringBlockParams
): Promise<{ success: boolean; template?: TimeBlock; instanceCount?: number; message: string }> {
  const {
    userId,
    title,
    startTime,
    endTime,
    blockType = 'task',
    color,
    description,
    reminderMinutesBefore = 15,
    endDate,
  } = params;

  console.log('[TimeBlock] Creating recurring daily block:', {
    userId,
    title,
    startTime,
    endTime,
    blockType,
  });

  try {
    // Create the template block first
    const today = getTodayISO();
    const templateStartTime = createDateTime(today, startTime);
    const templateEndTime = createDateTime(today, endTime);

    const recurrencePattern: RecurrencePattern = {
      frequency: 'daily',
      interval: 1,
      endDate: endDate || undefined,
    };

    const { data: template, error: templateError } = await supabase
      .from('time_blocks')
      .insert({
        user_id: userId,
        title,
        description: description || null,
        start_time: templateStartTime,
        end_time: templateEndTime,
        color: color || BLOCK_COLORS[blockType],
        is_recurring: true,
        recurrence_pattern: recurrencePattern,
        block_type: blockType,
        is_template: true,
        instance_date: null, // Templates don't have instance dates
        reminder_minutes_before: reminderMinutesBefore,
        buffer_minutes: 0,
      })
      .select()
      .single();

    if (templateError) {
      console.error('[TimeBlock] Error creating template:', templateError);
      return { success: false, message: 'Failed to create recurring block template' };
    }

    console.log('[TimeBlock] Template created:', template.id);

    // Generate instances for the next 30 days
    const instanceCount = await generateInstancesForTemplate(
      template.id,
      userId,
      today,
      getDateFromNow(30)
    );

    console.log('[TimeBlock] Generated instances:', instanceCount);

    return {
      success: true,
      template: template as TimeBlock,
      instanceCount,
      message: `Recurring block "${title}" created with ${instanceCount} instances`,
    };
  } catch (error) {
    console.error('[TimeBlock] Unexpected error:', error);
    return { success: false, message: 'An unexpected error occurred' };
  }
}

/**
 * Generate instances for a recurring template
 */
async function generateInstancesForTemplate(
  templateId: string,
  userId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  // Use the database function if available
  try {
    const { data, error } = await supabase.rpc('generate_recurring_instances', {
      p_template_id: templateId,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (!error && typeof data === 'number') {
      return data;
    }
  } catch (rpcError) {
    console.log('[TimeBlock] RPC not available, generating manually');
  }

  // Fallback: Manual instance generation
  // Get template details
  const { data: template, error: templateError } = await supabase
    .from('time_blocks')
    .select('*')
    .eq('id', templateId)
    .eq('is_template', true)
    .single();

  if (templateError || !template) {
    console.error('[TimeBlock] Template not found:', templateId);
    return 0;
  }

  // Extract time from template
  const templateStart = new Date(template.start_time);
  const templateEnd = new Date(template.end_time);
  const startHours = templateStart.getHours();
  const startMinutes = templateStart.getMinutes();
  const endHours = templateEnd.getHours();
  const endMinutes = templateEnd.getMinutes();

  // Generate instances
  const instances: Array<Record<string, unknown>> = [];
  const currentDate = new Date(startDate + 'T00:00:00');
  const finalDate = new Date(endDate + 'T00:00:00');

  while (currentDate <= finalDate) {
    const dateStr = currentDate.toISOString().split('T')[0];

    // Create start and end times for this date
    const instanceStart = new Date(currentDate);
    instanceStart.setHours(startHours, startMinutes, 0, 0);

    const instanceEnd = new Date(currentDate);
    instanceEnd.setHours(endHours, endMinutes, 0, 0);

    instances.push({
      user_id: userId,
      todo_id: template.todo_id,
      title: template.title,
      description: template.description,
      start_time: instanceStart.toISOString(),
      end_time: instanceEnd.toISOString(),
      color: template.color,
      is_recurring: false,
      block_type: template.block_type,
      energy_level: template.energy_level,
      parent_block_id: templateId,
      is_template: false,
      instance_date: dateStr,
      reminder_minutes_before: template.reminder_minutes_before,
      buffer_minutes: template.buffer_minutes || 0,
    });

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  if (instances.length === 0) {
    return 0;
  }

  // Insert instances in batches
  const { error: insertError } = await supabase
    .from('time_blocks')
    .insert(instances);

  if (insertError) {
    console.error('[TimeBlock] Error inserting instances:', insertError);
    return 0;
  }

  return instances.length;
}

/**
 * Get time blocks for a specific date
 */
export async function getTimeBlocksForDate(
  userId: string,
  date: string
): Promise<TimeBlock[]> {
  const { data, error } = await supabase
    .from('time_blocks')
    .select('*')
    .eq('user_id', userId)
    .eq('instance_date', date)
    .eq('is_template', false)
    .order('start_time', { ascending: true });

  if (error) {
    console.error('[TimeBlock] Error fetching blocks for date:', error);
    return [];
  }

  return data as TimeBlock[];
}

/**
 * Get today's time blocks
 */
export async function getTodayTimeBlocks(userId: string): Promise<TimeBlock[]> {
  return getTimeBlocksForDate(userId, getTodayISO());
}

/**
 * Get all recurring templates for a user
 */
export async function getRecurringTemplates(userId: string): Promise<TimeBlock[]> {
  const { data, error } = await supabase
    .from('time_blocks')
    .select('*')
    .eq('user_id', userId)
    .eq('is_template', true)
    .eq('is_recurring', true)
    .order('start_time', { ascending: true });

  if (error) {
    console.error('[TimeBlock] Error fetching templates:', error);
    return [];
  }

  return data as TimeBlock[];
}

/**
 * Complete a time block instance
 */
export async function completeTimeBlock(
  userId: string,
  blockId: string
): Promise<{ success: boolean; block?: TimeBlock; message: string }> {
  const { data, error } = await supabase
    .from('time_blocks')
    .update({
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', blockId)
    .eq('user_id', userId)
    .eq('is_template', false) // Can only complete instances, not templates
    .select()
    .single();

  if (error) {
    console.error('[TimeBlock] Error completing block:', error);
    return { success: false, message: 'Failed to complete time block' };
  }

  return {
    success: true,
    block: data as TimeBlock,
    message: 'Time block completed!',
  };
}

/**
 * Find a time block by title (for completing via natural language)
 */
export async function findTimeBlockByTitle(
  userId: string,
  title: string,
  date?: string
): Promise<{ success: boolean; block?: TimeBlock; blocks?: TimeBlock[]; message: string }> {
  const targetDate = date || getTodayISO();

  const { data, error } = await supabase
    .from('time_blocks')
    .select('*')
    .eq('user_id', userId)
    .eq('instance_date', targetDate)
    .eq('is_template', false)
    .ilike('title', `%${title}%`)
    .limit(5);

  if (error) {
    console.error('[TimeBlock] Error finding block:', error);
    return { success: false, message: 'Error searching for time block' };
  }

  if (!data || data.length === 0) {
    return { success: false, message: `No time block found matching "${title}" for today` };
  }

  if (data.length === 1) {
    return { success: true, block: data[0] as TimeBlock, message: 'Block found' };
  }

  return {
    success: false,
    blocks: data as TimeBlock[],
    message: `Multiple blocks found. Please be more specific:\n${data.map((b) => `- ${b.title}`).join('\n')}`,
  };
}

/**
 * Delete a recurring template and all its instances
 */
export async function deleteRecurringBlock(
  userId: string,
  templateId: string
): Promise<{ success: boolean; message: string }> {
  // First verify this is a template owned by the user
  const { data: template } = await supabase
    .from('time_blocks')
    .select('id, title')
    .eq('id', templateId)
    .eq('user_id', userId)
    .eq('is_template', true)
    .single();

  if (!template) {
    return { success: false, message: 'Recurring block not found' };
  }

  // Delete template (cascade will delete instances)
  const { error } = await supabase
    .from('time_blocks')
    .delete()
    .eq('id', templateId);

  if (error) {
    console.error('[TimeBlock] Error deleting template:', error);
    return { success: false, message: 'Failed to delete recurring block' };
  }

  return {
    success: true,
    message: `Recurring block "${template.title}" and all instances deleted`,
  };
}

/**
 * Skip a specific instance (delete just one day)
 */
export async function skipTimeBlockInstance(
  userId: string,
  instanceId: string
): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase
    .from('time_blocks')
    .delete()
    .eq('id', instanceId)
    .eq('user_id', userId)
    .eq('is_template', false)
    .select()
    .single();

  if (error) {
    console.error('[TimeBlock] Error skipping instance:', error);
    return { success: false, message: 'Failed to skip time block' };
  }

  return {
    success: true,
    message: `Skipped "${data.title}" for today`,
  };
}

/**
 * Get upcoming time blocks for reminders
 */
export async function getUpcomingBlocksForReminder(
  userId: string,
  withinMinutes: number = 30
): Promise<TimeBlock[]> {
  const now = new Date();
  const upcoming = new Date(now.getTime() + withinMinutes * 60 * 1000);

  const { data, error } = await supabase
    .from('time_blocks')
    .select('*')
    .eq('user_id', userId)
    .eq('is_template', false)
    .eq('reminder_sent', false)
    .is('completed_at', null)
    .gte('start_time', now.toISOString())
    .lte('start_time', upcoming.toISOString())
    .order('start_time', { ascending: true });

  if (error) {
    console.error('[TimeBlock] Error fetching upcoming blocks:', error);
    return [];
  }

  return data as TimeBlock[];
}

/**
 * Mark reminder as sent for a block
 */
export async function markReminderSent(blockId: string): Promise<void> {
  await supabase
    .from('time_blocks')
    .update({ reminder_sent: true })
    .eq('id', blockId);
}

/**
 * Extend recurring instances (called by cron job)
 * Generates new instances to maintain 30-day rolling window
 */
export async function extendRecurringInstances(): Promise<number> {
  // Get all active templates
  const { data: templates, error } = await supabase
    .from('time_blocks')
    .select('id, user_id, recurrence_pattern')
    .eq('is_template', true)
    .eq('is_recurring', true);

  if (error || !templates) {
    console.error('[TimeBlock] Error fetching templates for extension:', error);
    return 0;
  }

  let totalGenerated = 0;
  const startDate = getDateFromNow(25); // Start from day 25
  const endDate = getDateFromNow(35); // Extend to day 35

  for (const template of templates) {
    // Check if recurrence has ended
    const pattern = template.recurrence_pattern as RecurrencePattern;
    if (pattern?.endDate && new Date(pattern.endDate) < new Date()) {
      continue; // Skip templates that have ended
    }

    const count = await generateInstancesForTemplate(
      template.id,
      template.user_id,
      startDate,
      endDate
    );
    totalGenerated += count;
  }

  console.log('[TimeBlock] Extended recurring instances:', totalGenerated);
  return totalGenerated;
}

/**
 * Format a time block for display in Telegram
 */
export function formatTimeBlockForTelegram(block: TimeBlock): string {
  const startTime = formatTime(new Date(block.start_time).toTimeString().slice(0, 5));
  const endTime = formatTime(new Date(block.end_time).toTimeString().slice(0, 5));
  const status = block.completed_at ? '✅' : '⏰';
  const typeEmoji = getBlockTypeEmoji(block.block_type);

  return `${status} ${typeEmoji} *${block.title}*\n   ${startTime} - ${endTime}`;
}

/**
 * Get emoji for block type
 */
function getBlockTypeEmoji(type: TimeBlockType): string {
  const emojis: Record<TimeBlockType, string> = {
    task: '📋',
    focus: '🎯',
    break: '☕',
    meeting: '👥',
    personal: '🏠',
  };
  return emojis[type] || '📋';
}

/**
 * Get statistics for recurring blocks
 */
export async function getRecurringBlockStats(userId: string): Promise<{
  totalTemplates: number;
  todayBlocks: number;
  completedToday: number;
  weekCompletionRate: number;
}> {
  const today = getTodayISO();
  const weekAgo = getDateFromNow(-7);

  // Get template count
  const { count: templateCount } = await supabase
    .from('time_blocks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_template', true);

  // Get today's blocks
  const { data: todayBlocks } = await supabase
    .from('time_blocks')
    .select('id, completed_at')
    .eq('user_id', userId)
    .eq('instance_date', today)
    .eq('is_template', false);

  // Get week's blocks
  const { data: weekBlocks } = await supabase
    .from('time_blocks')
    .select('id, completed_at')
    .eq('user_id', userId)
    .eq('is_template', false)
    .gte('instance_date', weekAgo)
    .lte('instance_date', today);

  const todayCompleted = todayBlocks?.filter(b => b.completed_at).length || 0;
  const weekCompleted = weekBlocks?.filter(b => b.completed_at).length || 0;
  const weekTotal = weekBlocks?.length || 0;

  return {
    totalTemplates: templateCount || 0,
    todayBlocks: todayBlocks?.length || 0,
    completedToday: todayCompleted,
    weekCompletionRate: weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0,
  };
}
