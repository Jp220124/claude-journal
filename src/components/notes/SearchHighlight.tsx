'use client'

import { useMemo } from 'react'

interface SearchHighlightProps {
  text: string
  searchQuery: string
  className?: string
  highlightClassName?: string
  maxLength?: number
}

/**
 * Component that highlights search terms in text
 * Handles case-insensitive matching and multiple occurrences
 */
export function SearchHighlight({
  text,
  searchQuery,
  className = '',
  highlightClassName = 'bg-yellow-200 text-yellow-900 rounded px-0.5',
  maxLength,
}: SearchHighlightProps) {
  const parts = useMemo(() => {
    if (!searchQuery.trim() || !text) {
      return [{ text: maxLength ? truncateText(text, maxLength) : text, isMatch: false }]
    }

    const query = searchQuery.trim().toLowerCase()
    const textLower = text.toLowerCase()
    const result: Array<{ text: string; isMatch: boolean }> = []

    let lastIndex = 0
    let matchIndex = textLower.indexOf(query)
    let firstMatchIndex = -1

    // Find all matches
    while (matchIndex !== -1) {
      if (firstMatchIndex === -1) {
        firstMatchIndex = matchIndex
      }

      // Add text before match
      if (matchIndex > lastIndex) {
        result.push({
          text: text.slice(lastIndex, matchIndex),
          isMatch: false,
        })
      }

      // Add matched text
      result.push({
        text: text.slice(matchIndex, matchIndex + query.length),
        isMatch: true,
      })

      lastIndex = matchIndex + query.length
      matchIndex = textLower.indexOf(query, lastIndex)
    }

    // Add remaining text
    if (lastIndex < text.length) {
      result.push({
        text: text.slice(lastIndex),
        isMatch: false,
      })
    }

    // If we need to truncate, focus around the first match
    if (maxLength && text.length > maxLength && firstMatchIndex !== -1) {
      return truncateAroundMatch(result, maxLength, firstMatchIndex, query.length)
    }

    // Normal truncation if no match but maxLength specified
    if (maxLength && text.length > maxLength && result.length === 1) {
      return [{ text: truncateText(text, maxLength), isMatch: false }]
    }

    return result
  }, [text, searchQuery, maxLength])

  return (
    <span className={className}>
      {parts.map((part, index) => (
        part.isMatch ? (
          <mark key={index} className={highlightClassName}>
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      ))}
    </span>
  )
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 1) + '…'
}

function truncateAroundMatch(
  parts: Array<{ text: string; isMatch: boolean }>,
  maxLength: number,
  matchStart: number,
  matchLength: number
): Array<{ text: string; isMatch: boolean }> {
  // Calculate how much context to show around match
  const contextBefore = Math.floor((maxLength - matchLength) / 2)
  const contextAfter = maxLength - matchLength - contextBefore

  const result: Array<{ text: string; isMatch: boolean }> = []
  let charCount = 0
  let reachedMatch = false
  let addedEllipsisBefore = false

  for (const part of parts) {
    if (charCount >= maxLength) break

    if (part.isMatch && !reachedMatch) {
      reachedMatch = true
      // Add ellipsis if we truncated before
      if (matchStart > contextBefore && !addedEllipsisBefore) {
        result.unshift({ text: '…', isMatch: false })
      }
      result.push(part)
      charCount += part.text.length
    } else if (!reachedMatch) {
      // Before match
      const totalBeforeMatch = parts
        .slice(0, parts.indexOf(part) + 1)
        .reduce((sum, p) => sum + p.text.length, 0)

      if (totalBeforeMatch > contextBefore) {
        // Truncate this part
        const startSlice = Math.max(0, part.text.length - contextBefore)
        if (startSlice > 0) {
          addedEllipsisBefore = true
        }
        result.push({ text: part.text.slice(startSlice), isMatch: false })
        charCount += part.text.length - startSlice
      } else {
        result.push(part)
        charCount += part.text.length
      }
    } else {
      // After match
      const remaining = maxLength - charCount
      if (part.text.length > remaining) {
        result.push({ text: part.text.slice(0, remaining) + '…', isMatch: false })
        charCount += remaining
      } else {
        result.push(part)
        charCount += part.text.length
      }
    }
  }

  return result
}

/**
 * Hook to get highlighted text as HTML string
 * Useful for dangerouslySetInnerHTML scenarios
 */
export function useHighlightedHtml(
  text: string,
  searchQuery: string,
  options?: {
    highlightClassName?: string
    maxLength?: number
  }
): string {
  return useMemo(() => {
    if (!searchQuery.trim() || !text) {
      return options?.maxLength ? truncateText(text, options.maxLength) : text
    }

    const highlightClass = options?.highlightClassName || 'bg-yellow-200 text-yellow-900 rounded px-0.5'
    const query = searchQuery.trim()
    const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi')

    let result = text.replace(regex, `<mark class="${highlightClass}">$1</mark>`)

    if (options?.maxLength && text.length > options.maxLength) {
      // Find first match position
      const matchIndex = text.toLowerCase().indexOf(query.toLowerCase())
      if (matchIndex !== -1) {
        const contextBefore = Math.floor((options.maxLength - query.length) / 2)
        const start = Math.max(0, matchIndex - contextBefore)
        const end = Math.min(text.length, start + options.maxLength)

        let truncatedText = text.slice(start, end)
        if (start > 0) truncatedText = '…' + truncatedText
        if (end < text.length) truncatedText = truncatedText + '…'

        result = truncatedText.replace(regex, `<mark class="${highlightClass}">$1</mark>`)
      } else {
        result = truncateText(text, options.maxLength)
      }
    }

    return result
  }, [text, searchQuery, options?.highlightClassName, options?.maxLength])
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
