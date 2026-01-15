#!/usr/bin/env node

/**
 * Claude Journal MCP Server
 *
 * Provides MCP tools for accessing notes, tasks, and journal entries
 * from the Claude Journal application.
 *
 * Environment Variables Required:
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_SERVICE_KEY: Your Supabase service role key
 * - JOURNAL_USER_ID: The UUID of the user to access data for
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerNoteTools } from './tools/notes.js';
import { registerTaskTools } from './tools/tasks.js';
import { registerJournalTools } from './tools/journal.js';

// Validate environment variables
function validateEnvironment(): void {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'JOURNAL_USER_ID'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing.join(', '));
    console.error('\nRequired environment variables:');
    console.error('  SUPABASE_URL         - Your Supabase project URL');
    console.error('  SUPABASE_SERVICE_KEY - Your Supabase service role key');
    console.error('  JOURNAL_USER_ID      - The UUID of the user to access');
    process.exit(1);
  }
}

async function main(): Promise<void> {
  // Validate environment
  validateEnvironment();

  // Create MCP server
  const server = new McpServer({
    name: 'claude-journal',
    version: '1.0.0',
  });

  // Register all tools
  console.error('Registering note tools...');
  registerNoteTools(server);

  console.error('Registering task tools...');
  registerTaskTools(server);

  console.error('Registering journal tools...');
  registerJournalTools(server);

  // Create stdio transport
  const transport = new StdioServerTransport();

  // Connect server to transport
  console.error('Claude Journal MCP Server starting...');
  await server.connect(transport);
  console.error('Claude Journal MCP Server running on stdio');
}

// Run the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
