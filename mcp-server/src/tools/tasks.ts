import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId } from '../lib/supabase.js';
import { Todo, TaskCategory, createJsonResult, createErrorResult, createTextResult } from '../lib/types.js';

export function registerTaskTools(server: McpServer) {
  const userId = getUserId();

  // =====================================================
  // List Tasks
  // =====================================================
  server.tool(
    'list_tasks',
    'List all tasks with optional filtering',
    {
      status: z.enum(['pending', 'completed', 'all']).default('pending').describe('Filter by task status'),
      category_id: z.string().optional().describe('Filter by category ID'),
      priority: z.enum(['low', 'medium', 'high']).optional().describe('Filter by priority'),
      limit: z.number().default(50).describe('Maximum number of tasks to return'),
    },
    async ({ status, category_id, priority, limit }) => {
      try {
        let query = supabase
          .from('todos')
          .select('id, title, completed, priority, due_date, due_time, category, category_id, recurrence, notes, completed_date, order_index, created_at, updated_at')
          .eq('user_id', userId)
          .order('order_index', { ascending: true })
          .limit(limit);

        if (status === 'pending') {
          query = query.eq('completed', false);
        } else if (status === 'completed') {
          query = query.eq('completed', true);
        }

        if (category_id) {
          query = query.eq('category_id', category_id);
        }

        if (priority) {
          query = query.eq('priority', priority);
        }

        const { data, error } = await query;

        if (error) {
          return createErrorResult(error.message);
        }

        return createJsonResult({
          count: (data as Todo[]).length,
          tasks: data,
        });
      } catch (err) {
        return createErrorResult(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  );

  // =====================================================
  // Get Today's Tasks
  // =====================================================
  server.tool(
    'get_today_tasks',
    'Get all tasks due today',
    {},
    async () => {
      try {
        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('todos')
          .select('id, title, completed, priority, due_date, due_time, category, notes')
          .eq('user_id', userId)
          .eq('due_date', today)
          .order('priority', { ascending: false })
          .order('due_time', { ascending: true, nullsFirst: false });

        if (error) {
          return createErrorResult(error.message);
        }

        const tasks = data as Todo[];
        const pending = tasks.filter(t => !t.completed);
        const completed = tasks.filter(t => t.completed);

        return createJsonResult({
          date: today,
          total: tasks.length,
          pending: pending.length,
          completed: completed.length,
          tasks: {
            pending,
            completed,
          },
        });
      } catch (err) {
        return createErrorResult(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  );

  // =====================================================
  // Get Overdue Tasks
  // =====================================================
  server.tool(
    'get_overdue_tasks',
    'Get all overdue tasks',
    {},
    async () => {
      try {
        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('todos')
          .select('id, title, completed, priority, due_date, due_time, category, notes')
          .eq('user_id', userId)
          .eq('completed', false)
          .lt('due_date', today)
          .order('due_date', { ascending: true });

        if (error) {
          return createErrorResult(error.message);
        }

        return createJsonResult({
          count: (data as Todo[]).length,
          tasks: data,
        });
      } catch (err) {
        return createErrorResult(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  );

  // =====================================================
  // Create Task
  // =====================================================
  server.tool(
    'create_task',
    'Create a new task',
    {
      title: z.string().describe('Title of the task'),
      priority: z.enum(['low', 'medium', 'high']).default('medium').describe('Priority level'),
      due_date: z.string().optional().describe('Due date in YYYY-MM-DD format'),
      due_time: z.string().optional().describe('Due time in HH:MM format'),
      category_id: z.string().optional().describe('Category ID'),
      notes: z.string().optional().describe('Additional notes'),
      recurrence: z.string().optional().describe('Recurrence pattern (daily, weekly, monthly)'),
    },
    async ({ title, priority, due_date, due_time, category_id, notes, recurrence }) => {
      try {
        // Get the highest order_index
        const { data: lastTask } = await supabase
          .from('todos')
          .select('order_index')
          .eq('user_id', userId)
          .order('order_index', { ascending: false })
          .limit(1)
          .single();

        const orderIndex = lastTask ? (lastTask as { order_index: number }).order_index + 1 : 0;

        const { data, error } = await supabase
          .from('todos')
          .insert({
            user_id: userId,
            title,
            priority,
            due_date: due_date || null,
            due_time: due_time || null,
            category_id: category_id || null,
            notes: notes || null,
            recurrence: recurrence || null,
            completed: false,
            order_index: orderIndex,
          })
          .select('id, title, priority, due_date, created_at')
          .single();

        if (error) {
          return createErrorResult(error.message);
        }

        return createJsonResult({
          success: true,
          message: `Task "${title}" created successfully`,
          task: data,
        });
      } catch (err) {
        return createErrorResult(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  );

  // =====================================================
  // Complete Task
  // =====================================================
  server.tool(
    'complete_task',
    'Mark a task as completed',
    {
      task_id: z.string().describe('The ID of the task to complete'),
    },
    async ({ task_id }) => {
      try {
        const { data: existingTask, error: checkError } = await supabase
          .from('todos')
          .select('id, title, completed')
          .eq('id', task_id)
          .eq('user_id', userId)
          .single();

        if (checkError || !existingTask) {
          return createErrorResult('Task not found');
        }

        const task = existingTask as Todo & { title: string };

        if (task.completed) {
          return createTextResult(`Task "${task.title}" is already completed`);
        }

        const { error } = await supabase
          .from('todos')
          .update({
            completed: true,
            completed_date: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString(),
          })
          .eq('id', task_id)
          .eq('user_id', userId);

        if (error) {
          return createErrorResult(error.message);
        }

        return createTextResult(`Task "${task.title}" marked as completed`);
      } catch (err) {
        return createErrorResult(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  );

  // =====================================================
  // Uncomplete Task
  // =====================================================
  server.tool(
    'uncomplete_task',
    'Mark a completed task as pending again',
    {
      task_id: z.string().describe('The ID of the task to uncomplete'),
    },
    async ({ task_id }) => {
      try {
        const { data: existingTask, error: checkError } = await supabase
          .from('todos')
          .select('id, title, completed')
          .eq('id', task_id)
          .eq('user_id', userId)
          .single();

        if (checkError || !existingTask) {
          return createErrorResult('Task not found');
        }

        const task = existingTask as Todo & { title: string };

        if (!task.completed) {
          return createTextResult(`Task "${task.title}" is already pending`);
        }

        const { error } = await supabase
          .from('todos')
          .update({
            completed: false,
            completed_date: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', task_id)
          .eq('user_id', userId);

        if (error) {
          return createErrorResult(error.message);
        }

        return createTextResult(`Task "${task.title}" marked as pending`);
      } catch (err) {
        return createErrorResult(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  );

  // =====================================================
  // Update Task
  // =====================================================
  server.tool(
    'update_task',
    'Update an existing task',
    {
      task_id: z.string().describe('The ID of the task to update'),
      title: z.string().optional().describe('New title'),
      priority: z.enum(['low', 'medium', 'high']).optional().describe('New priority'),
      due_date: z.string().optional().describe('New due date (YYYY-MM-DD) or "null" to clear'),
      due_time: z.string().optional().describe('New due time (HH:MM) or "null" to clear'),
      category_id: z.string().optional().describe('New category ID or "null" to clear'),
      notes: z.string().optional().describe('New notes'),
    },
    async ({ task_id, title, priority, due_date, due_time, category_id, notes }) => {
      try {
        const { data: existingTask, error: checkError } = await supabase
          .from('todos')
          .select('id, title')
          .eq('id', task_id)
          .eq('user_id', userId)
          .single();

        if (checkError || !existingTask) {
          return createErrorResult('Task not found');
        }

        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (title !== undefined) updates.title = title;
        if (priority !== undefined) updates.priority = priority;
        if (due_date !== undefined) updates.due_date = due_date === 'null' ? null : due_date;
        if (due_time !== undefined) updates.due_time = due_time === 'null' ? null : due_time;
        if (category_id !== undefined) updates.category_id = category_id === 'null' ? null : category_id;
        if (notes !== undefined) updates.notes = notes;

        const { error } = await supabase
          .from('todos')
          .update(updates)
          .eq('id', task_id)
          .eq('user_id', userId);

        if (error) {
          return createErrorResult(error.message);
        }

        return createTextResult('Task updated successfully');
      } catch (err) {
        return createErrorResult(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  );

  // =====================================================
  // Delete Task
  // =====================================================
  server.tool(
    'delete_task',
    'Delete a task',
    {
      task_id: z.string().describe('The ID of the task to delete'),
    },
    async ({ task_id }) => {
      try {
        const { data: existingTask, error: checkError } = await supabase
          .from('todos')
          .select('id, title')
          .eq('id', task_id)
          .eq('user_id', userId)
          .single();

        if (checkError || !existingTask) {
          return createErrorResult('Task not found');
        }

        const task = existingTask as { title: string };

        const { error } = await supabase
          .from('todos')
          .delete()
          .eq('id', task_id)
          .eq('user_id', userId);

        if (error) {
          return createErrorResult(error.message);
        }

        return createTextResult(`Task "${task.title}" deleted`);
      } catch (err) {
        return createErrorResult(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  );

  // =====================================================
  // List Categories
  // =====================================================
  server.tool(
    'list_categories',
    'List all task categories',
    {},
    async () => {
      try {
        const { data, error } = await supabase
          .from('task_categories')
          .select('id, name, icon, color, is_recurring, is_active')
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('order_index', { ascending: true });

        if (error) {
          return createErrorResult(error.message);
        }

        return createJsonResult({
          count: (data as TaskCategory[]).length,
          categories: data,
        });
      } catch (err) {
        return createErrorResult(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  );

  // =====================================================
  // Get Task Summary
  // =====================================================
  server.tool(
    'get_task_summary',
    'Get a summary of all tasks (counts by status, priority, etc.)',
    {},
    async () => {
      try {
        const { data: allTasks, error } = await supabase
          .from('todos')
          .select('id, completed, priority, due_date')
          .eq('user_id', userId);

        if (error) {
          return createErrorResult(error.message);
        }

        const tasks = allTasks as Todo[];
        const today = new Date().toISOString().split('T')[0];

        const summary = {
          total: tasks.length,
          completed: tasks.filter(t => t.completed).length,
          pending: tasks.filter(t => !t.completed).length,
          overdue: tasks.filter(t => !t.completed && t.due_date && t.due_date < today).length,
          due_today: tasks.filter(t => t.due_date === today).length,
          by_priority: {
            high: tasks.filter(t => !t.completed && t.priority === 'high').length,
            medium: tasks.filter(t => !t.completed && t.priority === 'medium').length,
            low: tasks.filter(t => !t.completed && t.priority === 'low').length,
          },
        };

        return createJsonResult(summary);
      } catch (err) {
        return createErrorResult(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  );
}
