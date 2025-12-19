import { Node, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    columns: {
      /**
       * Set columns with a specific layout (e.g., '1-1', '1-2', '1-1-1-1')
       */
      setColumns: (layout?: string) => ReturnType
      /**
       * Remove columns and extract content
       */
      unsetColumns: () => ReturnType
      /**
       * Set columns with a specific count (1-6)
       */
      setColumnCount: (count: number) => ReturnType
      /**
       * Add a column to the current columns layout
       */
      addColumn: () => ReturnType
      /**
       * Remove the last column from the current columns layout
       */
      removeColumn: () => ReturnType
      /**
       * Insert a paragraph after the current block (useful in columns)
       */
      insertParagraphAfterBlock: () => ReturnType
    }
  }
}

// Helper to find the columns node from current selection
function findColumnsNode(state: any) {
  const { selection } = state
  const { $from } = selection

  let depth = $from.depth
  while (depth > 0) {
    const node = $from.node(depth)
    if (node.type.name === 'columns') {
      return { node, depth, pos: $from.before(depth) }
    }
    depth--
  }
  return null
}

// Columns container node - holds multiple Column nodes side by side
export const Columns = Node.create({
  name: 'columns',

  group: 'block',

  content: 'column+',

  defining: true,

  isolating: false, // Changed: Allow cursor to flow naturally

  allowGapCursor: true, // Allow gap cursor at boundaries

  addAttributes() {
    return {
      layout: {
        default: '1-1', // equal columns
        parseHTML: element => element.getAttribute('data-layout') || '1-1',
        renderHTML: attributes => ({
          'data-layout': attributes.layout,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="columns"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'columns',
        class: 'notes-columns',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setColumns:
        (layout = '1-1') =>
        ({ commands }) => {
          // Calculate number of columns from layout
          const columnCount = layout.split('-').length

          // Create column content
          const columns = Array(columnCount)
            .fill(null)
            .map(() => ({
              type: 'column',
              content: [{ type: 'paragraph' }],
            }))

          return commands.insertContent({
            type: this.name,
            attrs: { layout },
            content: columns,
          })
        },

      setColumnCount:
        (count: number) =>
        ({ commands }) => {
          // Validate count (1-6 columns)
          const validCount = Math.max(1, Math.min(6, count))
          // Generate layout string: 1 -> '1', 2 -> '1-1', 3 -> '1-1-1', etc.
          const layout = Array(validCount).fill('1').join('-')
          return commands.setColumns(layout)
        },

      addColumn:
        () =>
        ({ state, chain }) => {
          const columnsInfo = findColumnsNode(state)
          if (!columnsInfo) return false

          const { node, pos } = columnsInfo
          const currentLayout = node.attrs.layout || '1-1'
          const currentCount = currentLayout.split('-').length

          // Max 6 columns
          if (currentCount >= 6) return false

          // Create new layout with one more column
          const newLayout = currentLayout + '-1'

          // Create new column content
          const newColumn = {
            type: 'column',
            content: [{ type: 'paragraph' }],
          }

          // Get existing columns content
          const existingContent: any[] = []
          node.content.forEach((col: any) => {
            existingContent.push(col.toJSON())
          })
          existingContent.push(newColumn)

          return chain()
            .insertContentAt(
              { from: pos, to: pos + node.nodeSize },
              {
                type: 'columns',
                attrs: { layout: newLayout },
                content: existingContent,
              }
            )
            .run()
        },

      removeColumn:
        () =>
        ({ state, chain }) => {
          const columnsInfo = findColumnsNode(state)
          if (!columnsInfo) return false

          const { node, pos } = columnsInfo
          const currentLayout = node.attrs.layout || '1-1'
          const layoutParts = currentLayout.split('-')

          // Minimum 1 column (or remove columns entirely if already 1)
          if (layoutParts.length <= 1) {
            return chain().unsetColumns().run()
          }

          // Create new layout with one less column
          const newLayout = layoutParts.slice(0, -1).join('-')

          // Get existing columns content (excluding last)
          const existingContent: any[] = []
          let index = 0
          node.content.forEach((col: any) => {
            if (index < layoutParts.length - 1) {
              existingContent.push(col.toJSON())
            }
            index++
          })

          return chain()
            .insertContentAt(
              { from: pos, to: pos + node.nodeSize },
              {
                type: 'columns',
                attrs: { layout: newLayout },
                content: existingContent,
              }
            )
            .run()
        },

      unsetColumns:
        () =>
        ({ commands, state }) => {
          const { selection } = state
          const { $from } = selection

          // Find the columns node
          let depth = $from.depth
          while (depth > 0) {
            const node = $from.node(depth)
            if (node.type.name === 'columns') {
              // Extract content from all columns and insert as regular blocks
              const content: any[] = []
              node.content.forEach((column: any) => {
                column.content.forEach((block: any) => {
                  content.push(block.toJSON())
                })
              })

              return commands.insertContentAt(
                { from: $from.before(depth), to: $from.after(depth) },
                content
              )
            }
            depth--
          }
          return false
        },

      insertParagraphAfterBlock:
        () =>
        ({ state, chain }) => {
          const { selection } = state
          const { $from } = selection

          // Find the end of the current block
          let depth = $from.depth
          while (depth > 0) {
            const node = $from.node(depth)
            if (node.type.name === 'column' || node.type.isBlock) {
              // Insert paragraph after current position
              const endPos = $from.after(depth - 1)
              return chain()
                .insertContentAt(endPos, { type: 'paragraph' })
                .focus(endPos + 1)
                .run()
            }
            depth--
          }
          return false
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      // Mod+Enter to insert paragraph after current block (useful in columns)
      'Mod-Enter': ({ editor }) => {
        return editor.commands.insertParagraphAfterBlock()
      },
      // Allow backspace to exit columns when at start of first column
      Backspace: ({ editor }) => {
        const { selection } = editor.state
        const { $from } = selection

        // Check if we're at the start of a column
        if ($from.parentOffset === 0) {
          const column = $from.node($from.depth - 1)
          const columns = $from.node($from.depth - 2)

          if (column?.type.name === 'column' && columns?.type.name === 'columns') {
            // Check if this is the first column and we're at the start
            const columnIndex = $from.index($from.depth - 2)
            if (columnIndex === 0 && $from.parentOffset === 0) {
              return editor.commands.unsetColumns()
            }
          }
        }
        return false
      },
    }
  },
})

// Column node - individual column within Columns
export const Column = Node.create({
  name: 'column',

  group: 'column',

  content: 'block+',

  defining: true,

  isolating: false, // CHANGED: Allow cursor to flow in/out naturally

  allowGapCursor: true, // ADD: Enable gap cursor within columns

  addAttributes() {
    return {
      width: {
        default: null,
        parseHTML: element => element.style.width || null,
        renderHTML: attributes => {
          if (!attributes.width) return {}
          return { style: `width: ${attributes.width}` }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="column"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'column',
        class: 'notes-column',
      }),
      0,
    ]
  },
})

// Export both as array for easy import
export const ColumnsExtensions = [Columns, Column]
