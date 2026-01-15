# Claude Journal MCP Server

MCP (Model Context Protocol) server for accessing Claude Journal data from AI assistants like Claude.

## Features

### Note Tools
- `list_notes` - List all notes with filtering
- `read_note` - Read full content of a note
- `create_note` - Create a new note
- `update_note` - Update an existing note
- `delete_note` - Delete/archive a note
- `search_notes` - Search notes by content
- `list_folders` - List all folders
- `create_folder` - Create a new folder

### Task Tools
- `list_tasks` - List tasks with filtering
- `get_today_tasks` - Get tasks due today
- `get_overdue_tasks` - Get overdue tasks
- `create_task` - Create a new task
- `complete_task` - Mark task as complete
- `uncomplete_task` - Mark task as pending
- `update_task` - Update task properties
- `delete_task` - Delete a task
- `list_categories` - List task categories
- `get_task_summary` - Get task statistics

### Journal Tools
- `get_today_journal` - Get today's entry
- `read_journal_entry` - Read entry for date
- `create_journal_entry` - Create new entry
- `update_journal_entry` - Update entry
- `list_journal_entries` - List recent entries
- `search_journal` - Search entries
- `get_journal_stats` - Get statistics
- `delete_journal_entry` - Delete entry

## Setup

### 1. Get Your Credentials

You'll need:
- **Supabase URL**: From your Supabase project settings
- **Supabase Service Key**: From Supabase > Settings > API > service_role key
- **User ID**: Your user UUID from the database

### 2. Configure Claude Desktop

Add to your Claude Desktop configuration file:

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "journal": {
      "command": "node",
      "args": ["D:\\Journal Application\\Claude Journal\\claude-journal\\mcp-server\\build\\index.js"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_KEY": "your-service-role-key",
        "JOURNAL_USER_ID": "your-user-uuid"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

After saving the config, restart Claude Desktop to load the MCP server.

## Usage Examples

Once configured, you can ask Claude:

- "What notes do I have about React?"
- "Create a note titled 'Meeting Notes' with today's discussion"
- "What tasks are due today?"
- "Mark the 'Review PR' task as complete"
- "What did I write in my journal yesterday?"
- "Show me my task summary"

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development mode
npm run dev
```

## Security Notes

- The service role key bypasses Row Level Security - keep it secret!
- Never commit credentials to git
- The server only accesses data for the configured user ID
- Password-protected notes cannot be accessed via MCP

## License

MIT
