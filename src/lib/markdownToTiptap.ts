/**
 * Comprehensive Markdown to TipTap JSON Converter
 * Converts markdown text to TipTap-compatible ProseMirror JSON structure
 */

interface TipTapNode {
  type: string
  attrs?: Record<string, any>
  content?: TipTapNode[]
  marks?: { type: string; attrs?: Record<string, any> }[]
  text?: string
  [key: string]: unknown // Index signature for compatibility with Record<string, unknown>
}

export interface TipTapDoc {
  type: 'doc'
  content: TipTapNode[]
  [key: string]: unknown // Index signature for compatibility with Record<string, unknown>
}

/**
 * Parse inline markdown (bold, italic, code, links) and return TipTap content array
 */
function parseInlineMarkdown(text: string): TipTapNode[] {
  const nodes: TipTapNode[] = []
  let remaining = text

  while (remaining.length > 0) {
    // Bold: **text** or __text__
    const boldMatch = remaining.match(/^(\*\*|__)(.+?)\1/)
    if (boldMatch) {
      const innerContent = parseInlineMarkdown(boldMatch[2])
      innerContent.forEach(node => {
        if (node.text) {
          nodes.push({
            type: 'text',
            text: node.text,
            marks: [...(node.marks || []), { type: 'bold' }]
          })
        } else {
          nodes.push(node)
        }
      })
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }

    // Italic: *text* or _text_ (but not ** or __)
    const italicMatch = remaining.match(/^(\*|_)(?!\1)(.+?)\1(?!\1)/)
    if (italicMatch) {
      const innerContent = parseInlineMarkdown(italicMatch[2])
      innerContent.forEach(node => {
        if (node.text) {
          nodes.push({
            type: 'text',
            text: node.text,
            marks: [...(node.marks || []), { type: 'italic' }]
          })
        } else {
          nodes.push(node)
        }
      })
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }

    // Inline code: `code`
    const codeMatch = remaining.match(/^`([^`]+)`/)
    if (codeMatch) {
      nodes.push({
        type: 'text',
        text: codeMatch[1],
        marks: [{ type: 'code' }]
      })
      remaining = remaining.slice(codeMatch[0].length)
      continue
    }

    // Links: [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/)
    if (linkMatch) {
      nodes.push({
        type: 'text',
        text: linkMatch[1],
        marks: [{ type: 'link', attrs: { href: linkMatch[2], target: '_blank' } }]
      })
      remaining = remaining.slice(linkMatch[0].length)
      continue
    }

    // Wiki links: [[text]] - convert to regular link
    const wikiLinkMatch = remaining.match(/^\[\[([^\]]+)\]\]/)
    if (wikiLinkMatch) {
      nodes.push({
        type: 'text',
        text: wikiLinkMatch[1],
        marks: [{ type: 'link', attrs: { href: `#${wikiLinkMatch[1].replace(/\s+/g, '-').toLowerCase()}`, target: '_self' } }]
      })
      remaining = remaining.slice(wikiLinkMatch[0].length)
      continue
    }

    // Strikethrough: ~~text~~
    const strikeMatch = remaining.match(/^~~(.+?)~~/)
    if (strikeMatch) {
      nodes.push({
        type: 'text',
        text: strikeMatch[1],
        marks: [{ type: 'strike' }]
      })
      remaining = remaining.slice(strikeMatch[0].length)
      continue
    }

    // Regular text - find next special character
    const nextSpecial = remaining.search(/[\*_`\[~]/)
    if (nextSpecial === -1) {
      // No more special characters, push rest as text
      if (remaining.trim()) {
        nodes.push({ type: 'text', text: remaining })
      }
      break
    } else if (nextSpecial === 0) {
      // Special character at start that didn't match any pattern - treat as text
      nodes.push({ type: 'text', text: remaining[0] })
      remaining = remaining.slice(1)
    } else {
      // Push text up to special character
      nodes.push({ type: 'text', text: remaining.slice(0, nextSpecial) })
      remaining = remaining.slice(nextSpecial)
    }
  }

  return nodes.filter(n => n.text !== '')
}

/**
 * Parse a single line and determine its block type
 */
function parseBlockLine(line: string): { type: string; level?: number; content: string; checked?: boolean } {
  // Heading: # ## ### #### ##### ######
  const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
  if (headingMatch) {
    return { type: 'heading', level: headingMatch[1].length, content: headingMatch[2] }
  }

  // Horizontal rule: ---, ___, ***
  if (/^(-{3,}|_{3,}|\*{3,})$/.test(line.trim())) {
    return { type: 'horizontalRule', content: '' }
  }

  // Blockquote: > text
  const blockquoteMatch = line.match(/^>\s*(.*)$/)
  if (blockquoteMatch) {
    return { type: 'blockquote', content: blockquoteMatch[1] }
  }

  // Unordered list: - item, * item, + item
  const bulletMatch = line.match(/^(\s*)[-*+]\s+(.+)$/)
  if (bulletMatch) {
    return { type: 'bulletList', content: bulletMatch[2] }
  }

  // Ordered list: 1. item, 2. item
  const orderedMatch = line.match(/^(\s*)\d+\.\s+(.+)$/)
  if (orderedMatch) {
    return { type: 'orderedList', content: orderedMatch[2] }
  }

  // Task list: - [ ] item, - [x] item
  const taskMatch = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.+)$/)
  if (taskMatch) {
    return { type: 'taskList', content: taskMatch[3], checked: taskMatch[2].toLowerCase() === 'x' }
  }

  // Code block start/end: ```
  if (line.trim().startsWith('```')) {
    return { type: 'codeBlock', content: line.trim().slice(3) }
  }

  // Table row: | cell | cell | or |cell|cell|
  const tableRowMatch = line.match(/^\|(.+)\|$/)
  if (tableRowMatch) {
    return { type: 'tableRow', content: line }
  }

  // Regular paragraph
  return { type: 'paragraph', content: line }
}

/**
 * Parse a markdown table into TipTap table structure
 * Handles both standard markdown tables (rows on separate lines)
 * and concatenated tables (rows joined with ||)
 */
function parseMarkdownTable(tableLines: string[]): TipTapNode | null {
  if (tableLines.length < 1) return null

  // Join all lines and normalize - handle concatenated format (| cell || cell |)
  let tableText = tableLines.join('\n').trim()

  // Check if this is a concatenated table (rows joined with ||)
  // Split by || to get individual rows, but be careful of alignment separators
  let rows: string[] = []

  if (tableText.includes('||')) {
    // Split by || which indicates row boundaries in concatenated format
    rows = tableText.split(/\|\|/).map(row => {
      const trimmed = row.trim()
      // Ensure each row has proper pipe boundaries
      if (!trimmed.startsWith('|')) return '|' + trimmed
      if (!trimmed.endsWith('|')) return trimmed + '|'
      return trimmed
    }).filter(row => row.length > 2) // Filter out empty rows like "||"
  } else {
    // Standard format - rows on separate lines
    rows = tableText.split('\n').filter(line => line.trim())
  }

  if (rows.length < 2) return null

  // Find separator row (contains only |, -, :, and spaces)
  let separatorIndex = -1
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i].trim()
    // Check if this row is a separator (only contains |, -, :, spaces)
    if (/^\|[\s\-:]+(\|[\s\-:]+)*\|?$/.test(row) || /^[\s\-:|]+$/.test(row)) {
      separatorIndex = i
      break
    }
  }

  // If no separator found, treat first row as header
  if (separatorIndex === -1) {
    separatorIndex = 1
  }

  const headerRows = rows.slice(0, separatorIndex)
  const bodyRows = rows.slice(separatorIndex + 1)

  // Parse cells from a row
  const parseCells = (line: string): string[] => {
    // Remove leading/trailing pipes and split by |
    const trimmed = line.replace(/^\||\|$/g, '').trim()
    return trimmed.split('|').map(cell => cell.trim())
  }

  const tableNodes: TipTapNode[] = []

  // Parse header rows
  for (const headerLine of headerRows) {
    const cells = parseCells(headerLine)
    if (cells.length > 0 && cells.some(c => c.length > 0)) {
      tableNodes.push({
        type: 'tableRow',
        content: cells.map(cell => ({
          type: 'tableHeader',
          attrs: { colspan: 1, rowspan: 1 },
          content: [{
            type: 'paragraph',
            content: cell ? parseInlineMarkdown(cell) : []
          }]
        }))
      })
    }
  }

  // Parse body rows
  for (const bodyLine of bodyRows) {
    const cells = parseCells(bodyLine)
    if (cells.length > 0 && cells.some(c => c.length > 0)) {
      tableNodes.push({
        type: 'tableRow',
        content: cells.map(cell => ({
          type: 'tableCell',
          attrs: { colspan: 1, rowspan: 1 },
          content: [{
            type: 'paragraph',
            content: cell ? parseInlineMarkdown(cell) : []
          }]
        }))
      })
    }
  }

  if (tableNodes.length === 0) return null

  return {
    type: 'table',
    content: tableNodes
  }
}

/**
 * Convert markdown text to TipTap JSON structure
 */
export function markdownToTiptap(markdown: string): TipTapDoc {
  const lines = markdown.split('\n')
  const content: TipTapNode[] = []

  let i = 0
  let inCodeBlock = false
  let codeBlockContent: string[] = []
  let codeBlockLanguage = ''
  let currentList: TipTapNode | null = null
  let currentListType: string | null = null
  let blockquoteContent: string[] = []

  while (i < lines.length) {
    const line = lines[i]
    const parsed = parseBlockLine(line)

    // Handle code blocks
    if (parsed.type === 'codeBlock') {
      if (!inCodeBlock) {
        // Start code block
        inCodeBlock = true
        codeBlockLanguage = parsed.content || 'plaintext'
        codeBlockContent = []
      } else {
        // End code block
        inCodeBlock = false
        content.push({
          type: 'codeBlock',
          attrs: { language: codeBlockLanguage },
          content: codeBlockContent.length > 0 ? [{
            type: 'text',
            text: codeBlockContent.join('\n')
          }] : []
        })
        codeBlockContent = []
        codeBlockLanguage = ''
      }
      i++
      continue
    }

    if (inCodeBlock) {
      codeBlockContent.push(line)
      i++
      continue
    }

    // Handle blockquotes (can span multiple lines)
    if (parsed.type === 'blockquote') {
      blockquoteContent.push(parsed.content)
      i++
      // Check if next line is also a blockquote
      while (i < lines.length) {
        const nextParsed = parseBlockLine(lines[i])
        if (nextParsed.type === 'blockquote') {
          blockquoteContent.push(nextParsed.content)
          i++
        } else {
          break
        }
      }
      // Create blockquote node
      const blockquoteText = blockquoteContent.join('\n')
      content.push({
        type: 'blockquote',
        content: [{
          type: 'paragraph',
          content: parseInlineMarkdown(blockquoteText)
        }]
      })
      blockquoteContent = []
      continue
    }

    // Handle tables (consecutive table rows)
    if (parsed.type === 'tableRow') {
      const tableLines: string[] = [line]
      i++
      // Collect all consecutive table rows (including separator)
      while (i < lines.length) {
        const nextLine = lines[i]
        const nextParsed = parseBlockLine(nextLine)
        // Check if line is a table row or separator
        if (nextParsed.type === 'tableRow' || /^\|[\s\-:|\s]+\|$/.test(nextLine.trim()) || /^[\s\-:|\s]+$/.test(nextLine.trim())) {
          tableLines.push(nextLine)
          i++
        } else if (nextLine.trim() === '') {
          // Skip empty lines within table context, but stop if followed by non-table
          const lookAhead = i + 1 < lines.length ? parseBlockLine(lines[i + 1]) : null
          if (lookAhead && lookAhead.type === 'tableRow') {
            i++
            continue
          }
          break
        } else {
          break
        }
      }
      // Parse collected table lines
      const tableNode = parseMarkdownTable(tableLines)
      if (tableNode) {
        // Close any open list before adding table
        if (currentList) {
          content.push(currentList)
          currentList = null
          currentListType = null
        }
        content.push(tableNode)
      }
      continue
    }

    // Handle lists
    if (parsed.type === 'bulletList' || parsed.type === 'orderedList') {
      if (!currentList || currentListType !== parsed.type) {
        // Start new list
        if (currentList) {
          content.push(currentList)
        }
        currentListType = parsed.type
        currentList = {
          type: parsed.type,
          content: []
        }
      }
      // Add list item
      currentList.content!.push({
        type: 'listItem',
        content: [{
          type: 'paragraph',
          content: parseInlineMarkdown(parsed.content)
        }]
      })
      i++
      continue
    }

    // Handle task lists
    if (parsed.type === 'taskList') {
      if (!currentList || currentListType !== 'taskList') {
        if (currentList) {
          content.push(currentList)
        }
        currentListType = 'taskList'
        currentList = {
          type: 'taskList',
          content: []
        }
      }
      currentList.content!.push({
        type: 'taskItem',
        attrs: { checked: parsed.checked },
        content: [{
          type: 'paragraph',
          content: parseInlineMarkdown(parsed.content)
        }]
      })
      i++
      continue
    }

    // Close any open list
    if (currentList && parsed.type !== 'bulletList' && parsed.type !== 'orderedList' && parsed.type !== 'taskList') {
      content.push(currentList)
      currentList = null
      currentListType = null
    }

    // Handle horizontal rule
    if (parsed.type === 'horizontalRule') {
      content.push({ type: 'horizontalRule' })
      i++
      continue
    }

    // Handle headings
    if (parsed.type === 'heading') {
      content.push({
        type: 'heading',
        attrs: { level: parsed.level },
        content: parseInlineMarkdown(parsed.content)
      })
      i++
      continue
    }

    // Handle paragraphs
    if (parsed.type === 'paragraph') {
      if (parsed.content.trim()) {
        // Check for consecutive paragraph lines (not separated by blank line)
        let paragraphContent = parsed.content
        i++
        while (i < lines.length) {
          const nextLine = lines[i]
          const nextParsed = parseBlockLine(nextLine)
          // If next line is empty or a different block type, stop
          if (!nextLine.trim() || nextParsed.type !== 'paragraph') {
            break
          }
          paragraphContent += '\n' + nextParsed.content
          i++
        }

        const inlineContent = parseInlineMarkdown(paragraphContent)
        if (inlineContent.length > 0) {
          content.push({
            type: 'paragraph',
            content: inlineContent
          })
        }
      } else {
        // Empty line - could add empty paragraph or skip
        i++
      }
      continue
    }

    i++
  }

  // Close any remaining open list
  if (currentList) {
    content.push(currentList)
  }

  // Handle unclosed code block
  if (inCodeBlock && codeBlockContent.length > 0) {
    content.push({
      type: 'codeBlock',
      attrs: { language: codeBlockLanguage },
      content: [{
        type: 'text',
        text: codeBlockContent.join('\n')
      }]
    })
  }

  // If no content was parsed, add an empty paragraph
  if (content.length === 0) {
    content.push({
      type: 'paragraph',
      content: []
    })
  }

  return {
    type: 'doc',
    content
  }
}

/**
 * Extract plain text from markdown (for content_text field)
 */
export function markdownToPlainText(markdown: string): string {
  return markdown
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove wiki links
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    // Remove bold/italic
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    // Remove strikethrough
    .replace(/~~(.*?)~~/g, '$1')
    // Remove headings markers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove blockquote markers
    .replace(/^>\s*/gm, '')
    // Remove list markers
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // Remove horizontal rules
    .replace(/^(-{3,}|_{3,}|\*{3,})$/gm, '')
    // Remove task list markers
    .replace(/\[([ xX])\]\s*/g, '')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Convert markdown to HTML for preview rendering
 * More comprehensive than simple regex replacement
 */
export function markdownToHtml(markdown: string): string {
  let html = markdown

  // Process code blocks first (to protect content from other transformations)
  const codeBlocks: string[] = []
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const index = codeBlocks.length
    codeBlocks.push(`<pre class="code-block"><code class="language-${lang || 'plaintext'}">${escapeHtml(code.trim())}</code></pre>`)
    return `__CODE_BLOCK_${index}__`
  })

  // Process inline code
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')

  // Process tables (must be done before other transformations)
  // Match table blocks: header row, separator row, and data rows
  html = html.replace(/((?:^\|.+\|$\n?)+)/gm, (tableBlock) => {
    const lines = tableBlock.trim().split('\n').filter(line => line.trim())
    if (lines.length < 2) return tableBlock

    // Find separator row
    let separatorIndex = -1
    for (let i = 0; i < lines.length; i++) {
      if (/^\|[\s\-:]+\|$/.test(lines[i]) || /^[\|\s\-:]+$/.test(lines[i])) {
        separatorIndex = i
        break
      }
    }

    if (separatorIndex === -1) return tableBlock

    const headerRows = lines.slice(0, separatorIndex)
    const bodyRows = lines.slice(separatorIndex + 1)

    const parseCells = (line: string): string[] => {
      return line.replace(/^\||\|$/g, '').split('|').map(cell => cell.trim())
    }

    let tableHtml = '<table class="markdown-table">'

    // Header
    if (headerRows.length > 0) {
      tableHtml += '<thead>'
      for (const row of headerRows) {
        const cells = parseCells(row)
        tableHtml += '<tr>' + cells.map(cell => `<th>${cell}</th>`).join('') + '</tr>'
      }
      tableHtml += '</thead>'
    }

    // Body
    if (bodyRows.length > 0) {
      tableHtml += '<tbody>'
      for (const row of bodyRows) {
        const cells = parseCells(row)
        tableHtml += '<tr>' + cells.map(cell => `<td>${cell}</td>`).join('') + '</tr>'
      }
      tableHtml += '</tbody>'
    }

    tableHtml += '</table>'
    return tableHtml
  })

  // Process headings (must be at start of line)
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')

  // Process horizontal rules
  html = html.replace(/^(-{3,}|_{3,}|\*{3,})$/gm, '<hr class="divider" />')

  // Process blockquotes (can be multi-line)
  html = html.replace(/^>\s*(.*)$/gm, '<blockquote>$1</blockquote>')
  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n')

  // Process task lists
  html = html.replace(/^(\s*)[-*+]\s+\[x\]\s+(.+)$/gim, '$1<li class="task-item checked"><input type="checkbox" checked disabled /> $2</li>')
  html = html.replace(/^(\s*)[-*+]\s+\[\s\]\s+(.+)$/gim, '$1<li class="task-item"><input type="checkbox" disabled /> $2</li>')

  // Process unordered lists
  html = html.replace(/^(\s*)[-*+]\s+(.+)$/gm, '$1<li>$2</li>')

  // Process ordered lists
  html = html.replace(/^(\s*)\d+\.\s+(.+)$/gm, '$1<li class="ordered">$2</li>')

  // Wrap consecutive list items in ul/ol
  html = html.replace(/(<li class="ordered">[\s\S]*?<\/li>)(\n(?!<li))/g, '<ol>$1</ol>$2')
  html = html.replace(/(<li(?! class="ordered")>[\s\S]*?<\/li>)(\n(?!<li))/g, '<ul>$1</ul>$2')

  // Process bold (must be before italic)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>')

  // Process italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/_(.+?)_/g, '<em>$1</em>')

  // Process strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>')

  // Process links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')

  // Process wiki links (Obsidian-style)
  html = html.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '<a href="#$1" class="wiki-link">$2</a>')
  html = html.replace(/\[\[([^\]]+)\]\]/g, '<a href="#$1" class="wiki-link">$1</a>')

  // Process images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="markdown-image" />')

  // Convert line breaks within paragraphs
  // First, mark paragraph boundaries (double newlines)
  html = html.replace(/\n\n+/g, '__PARA_BREAK__')

  // Convert remaining single newlines to <br> only if not after block elements
  html = html.replace(/(?<!<\/(?:h[1-6]|blockquote|li|ul|ol|pre|hr)>)\n(?!<)/g, '<br />\n')

  // Restore paragraph breaks and wrap in <p> tags
  const paragraphs = html.split('__PARA_BREAK__')
  html = paragraphs.map(p => {
    const trimmed = p.trim()
    // Don't wrap block-level elements in p tags
    if (trimmed.startsWith('<h') ||
        trimmed.startsWith('<blockquote') ||
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<ol') ||
        trimmed.startsWith('<pre') ||
        trimmed.startsWith('<hr') ||
        trimmed.startsWith('<li') ||
        !trimmed) {
      return trimmed
    }
    return `<p>${trimmed}</p>`
  }).join('\n\n')

  // Restore code blocks
  codeBlocks.forEach((block, index) => {
    html = html.replace(`__CODE_BLOCK_${index}__`, block)
  })

  return html
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
