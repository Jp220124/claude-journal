/**
 * Time Block Handler
 * Handles recurring daily time blocks with reminders
 *
 * Features:
 * 1. Create recurring daily time blocks
 * 2. View today's/tomorrow's schedule
 * 3. Complete time blocks
 * 4. Skip recurring block instances
 * 5. Delete time blocks
 */

import { sendMessage, sendTypingAction } from '../services/telegram.js';
import { setState, resetState, getState } from '../services/conversationState.js';
import {
  createRecurringDailyBlock,
  getTimeBlocksForDate,
  getTodayTimeBlocks,
  completeTimeBlock,
  skipTimeBlockInstance,
  deleteRecurringBlock,
  findTimeBlockByTitle,
  formatTimeBlockForTelegram,
  getRecurringBlockStats,
  type CreateRecurringBlockParams,
} from '../services/timeBlockService.js';
import type { ParsedIntent } from '../services/gemini.js';

// Block type emojis for display
const BLOCK_TYPE_EMOJI: Record<string, string> = {
  task: '📋',
  focus: '🎯',
  break: '☕',
  meeting: '👥',
  personal: '🏃',
};

/**
 * Handle create time block intent
 */
export async function handleCreateTimeBlock(
  chatId: string,
  userId: string,
  params: ParsedIntent['parameters']
): Promise<void> {
  const title = params.title as string | undefined;
  const startTime = params.start_time as string | undefined;
  const endTime = params.end_time as string | undefined;
  const isRecurring = params.is_recurring as boolean | undefined;
  const blockType = (params.block_type as string | undefined) || 'task';
  const reminderMinutes = (params.reminder_minutes as number | undefined) || 15;
  const date = params.date as string | undefined;

  // If missing title, ask for it
  if (!title) {
    setState(
      chatId,
      'AWAITING_TIME_BLOCK_TITLE',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        startTime,
        endTime,
        isRecurring,
        blockType: blockType as CreateRecurringBlockParams['blockType'],
        reminderMinutes,
        date,
      }
    );
    await sendMessage(
      chatId,
      '📅 *Create Time Block*\n\n' +
        'What would you like to call this time block?\n\n' +
        '_Examples: Workout, Focus Time, Morning Meditation_'
    );
    return;
  }

  // If missing start time, ask for it
  if (!startTime) {
    setState(
      chatId,
      'AWAITING_TIME_BLOCK_TIME',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        title,
        endTime,
        isRecurring,
        blockType: blockType as CreateRecurringBlockParams['blockType'],
        reminderMinutes,
        date,
      }
    );
    await sendMessage(
      chatId,
      `📅 *Create Time Block: ${title}*\n\n` +
        'What time should this block start?\n\n' +
        '_Examples: 6am, 9:30am, 14:00, 2pm_'
    );
    return;
  }

  // Calculate end time if not provided (default 1 hour)
  const calculatedEndTime = endTime || addHourToTime(startTime);

  await sendTypingAction(chatId);

  try {
    // Create the time block
    const result = await createRecurringDailyBlock({
      userId,
      title,
      startTime,
      endTime: calculatedEndTime,
      blockType: blockType as CreateRecurringBlockParams['blockType'],
      reminderMinutesBefore: reminderMinutes,
    });

    if (result.success) {
      const emoji = BLOCK_TYPE_EMOJI[blockType] || '📅';
      const recurringText = (isRecurring ?? true)
        ? '🔄 Repeats daily'
        : `📆 ${date || 'Today only'}`;

      await sendMessage(
        chatId,
        `${emoji} *Time Block Created!*\n\n` +
          `📋 ${title}\n` +
          `⏰ ${formatTime(startTime)} - ${formatTime(calculatedEndTime)}\n` +
          `${recurringText}\n` +
          `🔔 Reminder ${reminderMinutes} min before\n\n` +
          (result.instanceCount ? `_Created ${result.instanceCount} instances for the next 30 days_` : '') +
          '\n_View in Daily Journal app_'
      );
      console.log(`[TimeBlock] Created block "${title}" for user ${userId}`);
      resetState(chatId);
    } else {
      await sendMessage(chatId, `❌ Failed to create time block: ${result.message}`);
    }
  } catch (error) {
    console.error('[TimeBlock] Error creating block:', error);
    await sendMessage(chatId, '❌ Something went wrong. Please try again.');
  }
}

/**
 * Handle show schedule intent
 */
export async function handleShowSchedule(
  chatId: string,
  userId: string,
  params: ParsedIntent['parameters']
): Promise<void> {
  const dateFilter = (params.date as string) || 'today';

  await sendTypingAction(chatId);

  try {
    let blocks;
    let dateLabel: string;

    if (dateFilter === 'today') {
      blocks = await getTodayTimeBlocks(userId);
      dateLabel = 'Today';
    } else if (dateFilter === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      blocks = await getTimeBlocksForDate(userId, tomorrow.toISOString().split('T')[0]);
      dateLabel = 'Tomorrow';
    } else {
      // Week view - get today + 6 days
      const allBlocks = [];
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dayBlocks = await getTimeBlocksForDate(userId, date.toISOString().split('T')[0]);
        allBlocks.push(...dayBlocks);
      }
      blocks = allBlocks;
      dateLabel = 'This Week';
    }

    if (!blocks || blocks.length === 0) {
      await sendMessage(
        chatId,
        `📅 *${dateLabel}'s Schedule*\n\n` +
          '_No time blocks scheduled._\n\n' +
          '💡 Create one with:\n' +
          '"Schedule workout 6-7am daily"'
      );
      return;
    }

    // Format blocks for display
    const formattedBlocks = blocks
      .map((block) => {
        const emoji = BLOCK_TYPE_EMOJI[block.block_type] || '📅';
        const status = block.completed_at ? '✅' : '⏳';
        const startTime = new Date(block.start_time).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        const endTime = new Date(block.end_time).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        return `${status} ${emoji} *${block.title}*\n   ${startTime} - ${endTime}`;
      })
      .join('\n\n');

    // Get stats
    const stats = await getRecurringBlockStats(userId);

    await sendMessage(
      chatId,
      `📅 *${dateLabel}'s Schedule*\n\n` +
        formattedBlocks +
        '\n\n' +
        `📊 ${stats.completedToday}/${stats.todayBlocks} completed today`
    );
  } catch (error) {
    console.error('[TimeBlock] Error showing schedule:', error);
    await sendMessage(chatId, '❌ Something went wrong. Please try again.');
  }
}

/**
 * Handle complete time block intent
 */
export async function handleCompleteTimeBlock(
  chatId: string,
  userId: string,
  params: ParsedIntent['parameters']
): Promise<void> {
  const identifier = params.block_identifier as string;

  await sendTypingAction(chatId);

  try {
    // Find the block by title
    const findResult = await findTimeBlockByTitle(userId, identifier);

    if (!findResult.success || !findResult.block) {
      await sendMessage(
        chatId,
        `❌ Couldn't find a time block matching "${identifier}"\n\n` +
          '_Try "Show my schedule" to see your blocks_'
      );
      return;
    }

    const block = findResult.block;

    // Complete the block
    const result = await completeTimeBlock(userId, block.id);

    if (result.success) {
      const emoji = BLOCK_TYPE_EMOJI[block.block_type] || '📅';
      await sendMessage(
        chatId,
        `✅ *Block Completed!*\n\n` +
          `${emoji} ${block.title}\n\n` +
          '_Great job staying on schedule!_'
      );
      console.log(`[TimeBlock] Completed block "${block.title}" for user ${userId}`);
    } else {
      await sendMessage(chatId, `❌ Failed to complete block: ${result.message}`);
    }
  } catch (error) {
    console.error('[TimeBlock] Error completing block:', error);
    await sendMessage(chatId, '❌ Something went wrong. Please try again.');
  }
}

/**
 * Handle skip time block intent
 */
export async function handleSkipTimeBlock(
  chatId: string,
  userId: string,
  params: ParsedIntent['parameters']
): Promise<void> {
  const identifier = params.block_identifier as string;

  await sendTypingAction(chatId);

  try {
    // Find the block by title
    const findResult = await findTimeBlockByTitle(userId, identifier);

    if (!findResult.success || !findResult.block) {
      await sendMessage(
        chatId,
        `❌ Couldn't find a time block matching "${identifier}"\n\n` +
          '_Try "Show my schedule" to see your blocks_'
      );
      return;
    }

    const block = findResult.block;

    // Skip this instance
    const result = await skipTimeBlockInstance(userId, block.id);

    if (result.success) {
      const emoji = BLOCK_TYPE_EMOJI[block.block_type] || '📅';
      await sendMessage(
        chatId,
        `⏭️ *Block Skipped*\n\n` +
          `${emoji} ${block.title}\n\n` +
          (block.parent_block_id
            ? "_It will appear again tomorrow._"
            : "_One-time block removed._")
      );
      console.log(`[TimeBlock] Skipped block "${block.title}" for user ${userId}`);
    } else {
      await sendMessage(chatId, `❌ Failed to skip block: ${result.message}`);
    }
  } catch (error) {
    console.error('[TimeBlock] Error skipping block:', error);
    await sendMessage(chatId, '❌ Something went wrong. Please try again.');
  }
}

/**
 * Handle delete time block intent
 */
export async function handleDeleteTimeBlock(
  chatId: string,
  userId: string,
  params: ParsedIntent['parameters']
): Promise<void> {
  const identifier = params.block_identifier as string;

  await sendTypingAction(chatId);

  try {
    // Find the block by title
    const findResult = await findTimeBlockByTitle(userId, identifier);

    if (!findResult.success || !findResult.block) {
      await sendMessage(
        chatId,
        `❌ Couldn't find a time block matching "${identifier}"\n\n` +
          '_Try "Show my schedule" to see your blocks_'
      );
      return;
    }

    const block = findResult.block;

    // Delete the block (and all instances if recurring)
    const result = await deleteRecurringBlock(userId, block.parent_block_id || block.id);

    if (result.success) {
      const emoji = BLOCK_TYPE_EMOJI[block.block_type] || '📅';
      await sendMessage(
        chatId,
        `🗑️ *Block Deleted*\n\n` +
          `${emoji} ${block.title}\n\n` +
          (block.parent_block_id
            ? '_Deleted template and all instances_'
            : '_Block removed_')
      );
      console.log(`[TimeBlock] Deleted block "${block.title}" for user ${userId}`);
    } else {
      await sendMessage(chatId, `❌ Failed to delete block: ${result.message}`);
    }
  } catch (error) {
    console.error('[TimeBlock] Error deleting block:', error);
    await sendMessage(chatId, '❌ Something went wrong. Please try again.');
  }
}

/**
 * Handle conversation state for time block flow
 */
export async function handleTimeBlockConversation(
  chatId: string,
  userId: string,
  userMessage: string
): Promise<boolean> {
  const state = getState(chatId);

  if (state.state === 'AWAITING_TIME_BLOCK_TITLE') {
    // User provided title, now ask for time
    setState(
      chatId,
      'AWAITING_TIME_BLOCK_TIME',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        ...state.pendingTimeBlock,
        title: userMessage.trim(),
      }
    );
    await sendMessage(
      chatId,
      `📅 *Time Block: ${userMessage.trim()}*\n\n` +
        'What time should this block start?\n\n' +
        '_Examples: 6am, 9:30am, 14:00_\n' +
        '_Or say "6am to 7am" for start and end_'
    );
    return true;
  }

  if (state.state === 'AWAITING_TIME_BLOCK_TIME') {
    // Parse the time input
    const timeInput = userMessage.trim().toLowerCase();
    let startTime: string;
    let endTime: string | undefined;

    // Check for time range (e.g., "6am to 7am" or "6-7am")
    const rangeMatch = timeInput.match(
      /(\d{1,2}(?::\d{2})?)\s*(?:am|pm)?\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?)\s*(?:am|pm)?/i
    );

    if (rangeMatch) {
      startTime = parseTimeToHHMM(rangeMatch[1] + (timeInput.includes('am') ? 'am' : timeInput.includes('pm') ? 'pm' : ''));
      endTime = parseTimeToHHMM(rangeMatch[2] + (timeInput.includes('am') ? 'am' : timeInput.includes('pm') ? 'pm' : ''));
    } else {
      startTime = parseTimeToHHMM(timeInput);
      endTime = state.pendingTimeBlock.endTime || addHourToTime(startTime);
    }

    if (!startTime) {
      await sendMessage(
        chatId,
        '❌ I couldn\'t understand that time.\n\n' +
          '_Try formats like: 6am, 9:30am, 14:00, or "6am to 7am"_'
      );
      return true;
    }

    // Create the block
    await sendTypingAction(chatId);

    const result = await createRecurringDailyBlock({
      userId,
      title: state.pendingTimeBlock.title!,
      startTime,
      endTime: endTime || addHourToTime(startTime),
      blockType: state.pendingTimeBlock.blockType || 'task',
      reminderMinutesBefore: state.pendingTimeBlock.reminderMinutes || 15,
    });

    if (result.success) {
      const emoji = BLOCK_TYPE_EMOJI[state.pendingTimeBlock.blockType || 'task'] || '📅';
      const recurringText = (state.pendingTimeBlock.isRecurring ?? true)
        ? '🔄 Repeats daily'
        : `📆 ${state.pendingTimeBlock.date || 'Today only'}`;

      await sendMessage(
        chatId,
        `${emoji} *Time Block Created!*\n\n` +
          `📋 ${state.pendingTimeBlock.title}\n` +
          `⏰ ${formatTime(startTime)} - ${formatTime(endTime || addHourToTime(startTime))}\n` +
          `${recurringText}\n` +
          `🔔 Reminder ${state.pendingTimeBlock.reminderMinutes || 15} min before\n\n` +
          (result.instanceCount ? `_Created ${result.instanceCount} instances_` : '')
      );
      resetState(chatId);
    } else {
      await sendMessage(chatId, `❌ Failed to create block: ${result.message}`);
    }

    return true;
  }

  return false;
}

// =====================================================
// Helper Functions
// =====================================================

/**
 * Parse time string to HH:MM format
 */
function parseTimeToHHMM(timeStr: string): string {
  const input = timeStr.toLowerCase().trim();

  // Handle HH:MM format
  if (/^\d{1,2}:\d{2}$/.test(input)) {
    const [h, m] = input.split(':');
    return `${h.padStart(2, '0')}:${m}`;
  }

  // Handle am/pm format
  const match = input.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2] || '00';
    const period = match[3]?.toLowerCase();

    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;

    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }

  return '';
}

/**
 * Add one hour to a time string
 */
function addHourToTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const newHour = (h + 1) % 24;
  return `${newHour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Format time for display (HH:MM to 12-hour format)
 */
function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}
