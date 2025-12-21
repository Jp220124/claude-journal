'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { ResearchSource } from '@/types/database'

interface ResearchNoteRendererProps {
  content: string
  sources: ResearchSource[]
  className?: string
}

interface ParsedSection {
  type: 'tldr' | 'numbers' | 'insights' | 'actions' | 'sources' | 'findings' | 'analysis' | 'recommendations' | 'other'
  title: string
  content: string
  items?: string[]
  insights?: { title: string; content: string; citation?: string }[]
}

/**
 * Detect section type from header text
 */
function detectSectionType(headerLine: string): ParsedSection['type'] {
  const header = headerLine.toLowerCase()

  // New format (with emojis)
  if (headerLine.includes('🎯') || header.includes('tl;dr')) return 'tldr'
  if (headerLine.includes('📊') || header.includes('key numbers')) return 'numbers'
  if (headerLine.includes('💡') && header.includes('insight')) return 'insights'
  if (headerLine.includes('⚡') || header.includes('action item')) return 'actions'
  if (headerLine.includes('📚')) return 'sources'

  // Old format (without emojis) - Map to appropriate types
  if (header.includes('executive summary') || header.includes('summary')) return 'tldr'
  if (header.includes('key finding') || header.includes('findings')) return 'findings'
  if (header.includes('important facts') || header.includes('facts & figures') || header.includes('key statistics')) return 'numbers'
  if (header.includes('detailed analysis') || header.includes('analysis')) return 'analysis'
  if (header.includes('recommendation') || header.includes('next step')) return 'recommendations'
  if (header.includes('source')) return 'sources'

  return 'other'
}

/**
 * Extract bullet items from content
 */
function extractBulletItems(content: string): string[] {
  return content
    .split('\n')
    .filter(line => line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*'))
    .map(line => line.replace(/^[•\-*]\s*/, '').trim())
    .filter(Boolean)
}

/**
 * Parse insights with ### subheadings
 */
function parseInsights(content: string): { title: string; content: string; citation?: string }[] {
  const insights: { title: string; content: string; citation?: string }[] = []
  const insightBlocks = content.split(/(?=### \d)/g).filter(Boolean)

  for (const block of insightBlocks) {
    const blockLines = block.trim().split('\n')
    const titleMatch = blockLines[0]?.match(/###\s*\d+\.?\s*(.+)/)
    if (titleMatch) {
      const insightContent = blockLines.slice(1).join(' ').trim()
      const citationMatch = insightContent.match(/\[(\d+)\]/)
      insights.push({
        title: titleMatch[1].trim(),
        content: insightContent.replace(/\[\d+\]/g, '').trim(),
        citation: citationMatch?.[1]
      })
    }
  }

  return insights
}

/**
 * Parse research note content into structured sections
 * Supports both NEW format (with emojis) and OLD format (Executive Summary, Key Findings, etc.)
 */
function parseResearchContent(content: string): ParsedSection[] {
  const sections: ParsedSection[] = []

  // Split by ## or ### headers (both new and old formats)
  const parts = content.split(/(?=^#{2,3}\s+)/gm).filter(Boolean)

  for (const part of parts) {
    const lines = part.trim().split('\n')
    const headerLine = lines[0] || ''
    const bodyLines = lines.slice(1).join('\n').trim()

    // Skip if not a header
    if (!headerLine.startsWith('#')) continue

    const sectionType = detectSectionType(headerLine)
    const title = headerLine.replace(/^#+\s*/, '').replace(/[🎯📊💡⚡📚]/g, '').trim()

    // Parse content based on section type
    switch (sectionType) {
      case 'tldr':
        sections.push({
          type: 'tldr',
          title: 'TL;DR',
          content: bodyLines.replace(/^[\s\n]+/, '')
        })
        break

      case 'numbers':
        sections.push({
          type: 'numbers',
          title: 'Key Numbers',
          content: bodyLines,
          items: extractBulletItems(bodyLines)
        })
        break

      case 'insights':
        sections.push({
          type: 'insights',
          title: 'Top Insights',
          content: bodyLines,
          insights: parseInsights(bodyLines)
        })
        break

      case 'actions':
      case 'recommendations':
        sections.push({
          type: 'actions',
          title: sectionType === 'recommendations' ? 'Recommendations' : 'Action Items',
          content: bodyLines,
          items: extractBulletItems(bodyLines)
        })
        break

      case 'findings':
        // Parse key findings as insights
        const findingItems = extractBulletItems(bodyLines)
        sections.push({
          type: 'findings',
          title: 'Key Findings',
          content: bodyLines,
          items: findingItems,
          insights: findingItems.map((item, i) => ({
            title: `Finding ${i + 1}`,
            content: item.replace(/^\*\*(.+?)\*\*:?\s*/, '').trim(),
            citation: undefined
          }))
        })
        break

      case 'analysis':
        sections.push({
          type: 'analysis',
          title: 'Detailed Analysis',
          content: bodyLines
        })
        break

      case 'sources':
        sections.push({
          type: 'sources',
          title: 'Sources',
          content: bodyLines
        })
        break

      default:
        sections.push({
          type: 'other',
          title,
          content: bodyLines
        })
    }
  }

  return sections
}

/**
 * TL;DR Card Component
 */
function TLDRCard({ content }: { content: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 p-6 text-white shadow-xl">
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-4 -left-4 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
      <div className="relative">
        <div className="mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-2xl">target</span>
          <h3 className="text-lg font-bold tracking-wide">TL;DR</h3>
        </div>
        <p className="text-lg font-medium leading-relaxed text-white/95">
          {content}
        </p>
      </div>
    </div>
  )
}

/**
 * Key Numbers Card Component
 */
function KeyNumbersCard({ items }: { items: string[] }) {
  if (!items || items.length === 0) return null

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-xl text-emerald-600">analytics</span>
        <h3 className="text-base font-bold text-slate-800">Key Numbers</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item, i) => {
          // Parse "**number** — description" format
          const match = item.match(/\*\*(.+?)\*\*\s*[—–-]\s*(.+)/)
          const number = match?.[1] || item.split(/[—–-]/)[0]?.trim()
          const description = match?.[2] || item.split(/[—–-]/).slice(1).join('-').trim()

          return (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
                <span className="material-symbols-outlined text-lg text-emerald-600">
                  {i === 0 ? 'trending_up' : i === 1 ? 'percent' : i === 2 ? 'groups' : 'query_stats'}
                </span>
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-700">{number?.replace(/\*\*/g, '')}</p>
                <p className="text-sm text-slate-600">{description}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Insights Card Component
 */
function InsightsCard({ insights }: { insights: { title: string; content: string; citation?: string }[] }) {
  if (!insights || insights.length === 0) return null

  const colors = [
    { bg: 'from-blue-50 to-cyan-50', border: 'border-blue-200', icon: 'bg-blue-100', iconColor: 'text-blue-600', number: 'bg-blue-500' },
    { bg: 'from-amber-50 to-orange-50', border: 'border-amber-200', icon: 'bg-amber-100', iconColor: 'text-amber-600', number: 'bg-amber-500' },
    { bg: 'from-rose-50 to-pink-50', border: 'border-rose-200', icon: 'bg-rose-100', iconColor: 'text-rose-600', number: 'bg-rose-500' },
  ]

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-xl text-amber-500">lightbulb</span>
        <h3 className="text-base font-bold text-slate-800">Top Insights</h3>
      </div>
      <div className="space-y-4">
        {insights.map((insight, i) => {
          const color = colors[i % colors.length]
          return (
            <div
              key={i}
              className={cn(
                "relative rounded-xl border bg-gradient-to-br p-4 transition-all hover:shadow-md",
                color.bg,
                color.border
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white", color.number)}>
                  {i + 1}
                </div>
                <div>
                  <h4 className="mb-1 font-semibold text-slate-800">{insight.title}</h4>
                  <p className="text-sm leading-relaxed text-slate-600">{insight.content}</p>
                  {insight.citation && (
                    <span className="mt-2 inline-block rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                      Source [{insight.citation}]
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Action Items Card Component
 */
function ActionsCard({ items }: { items: string[] }) {
  if (!items || items.length === 0) return null

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-xl text-indigo-600">bolt</span>
        <h3 className="text-base font-bold text-slate-800">Action Items</h3>
      </div>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-indigo-400 bg-white">
              <div className="h-2 w-2 rounded-full bg-indigo-400" />
            </div>
            <span className="text-sm leading-relaxed text-slate-700">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Findings Card Component (for old format Key Findings)
 */
function FindingsCard({ insights, items }: { insights?: { title: string; content: string }[]; items?: string[] }) {
  // If we have parsed insights, use them
  if (insights && insights.length > 0) {
    const colors = [
      { bg: 'from-emerald-50 to-teal-50', border: 'border-emerald-200', number: 'bg-emerald-500' },
      { bg: 'from-blue-50 to-cyan-50', border: 'border-blue-200', number: 'bg-blue-500' },
      { bg: 'from-amber-50 to-orange-50', border: 'border-amber-200', number: 'bg-amber-500' },
      { bg: 'from-rose-50 to-pink-50', border: 'border-rose-200', number: 'bg-rose-500' },
      { bg: 'from-violet-50 to-purple-50', border: 'border-violet-200', number: 'bg-violet-500' },
      { bg: 'from-cyan-50 to-sky-50', border: 'border-cyan-200', number: 'bg-cyan-500' },
    ]

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-xl text-emerald-600">fact_check</span>
          <h3 className="text-base font-bold text-slate-800">Key Findings</h3>
        </div>
        <div className="space-y-3">
          {insights.map((insight, i) => {
            const color = colors[i % colors.length]
            return (
              <div
                key={i}
                className={cn(
                  "relative rounded-xl border bg-gradient-to-br p-4 transition-all hover:shadow-md",
                  color.bg,
                  color.border
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white", color.number)}>
                    {i + 1}
                  </div>
                  <p className="text-sm leading-relaxed text-slate-700">{insight.content}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Fallback to simple bullet list
  if (!items || items.length === 0) return null

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-xl text-emerald-600">fact_check</span>
        <h3 className="text-base font-bold text-slate-800">Key Findings</h3>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
            <span className="material-symbols-outlined text-emerald-500 text-base mt-0.5">check_circle</span>
            <span dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(item) }} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Analysis Card Component (for detailed analysis sections)
 */
function AnalysisCard({ content, title }: { content: string; title: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-gray-50 p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-xl text-slate-600">analytics</span>
        <h3 className="text-base font-bold text-slate-800">{title}</h3>
      </div>
      <div
        className="prose prose-sm prose-slate max-w-none"
        dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(content) }}
      />
    </div>
  )
}

/**
 * Summary/TL;DR Card for old format
 */
function SummaryCard({ content }: { content: string }) {
  // Clean up the content - remove extra markdown formatting
  const cleanContent = content.trim()

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 p-6 text-white shadow-xl">
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-4 -left-4 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
      <div className="relative">
        <div className="mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-2xl">summarize</span>
          <h3 className="text-lg font-bold tracking-wide">Executive Summary</h3>
        </div>
        <div
          className="text-base font-medium leading-relaxed text-white/95 prose prose-invert prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(cleanContent) }}
        />
      </div>
    </div>
  )
}

/**
 * Main Research Note Renderer
 */
export function ResearchNoteRenderer({ content, sources, className }: ResearchNoteRendererProps) {
  const sections = useMemo(() => parseResearchContent(content), [content])

  // Check if we have any recognized structured content
  const recognizedTypes: ParsedSection['type'][] = ['tldr', 'numbers', 'insights', 'actions', 'findings', 'analysis', 'recommendations']
  const hasStructuredContent = sections.some(s => recognizedTypes.includes(s.type))

  if (!hasStructuredContent || sections.length === 0) {
    // Fall back to simple markdown rendering
    return (
      <div className={cn("prose prose-slate max-w-none", className)}>
        <div dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(content) }} />
      </div>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Research Badge */}
      <div className="flex items-center gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-3 py-1 text-xs font-semibold text-white shadow-sm">
          <span className="material-symbols-outlined text-sm">science</span>
          AI Research Brief
        </div>
        <span className="text-xs text-slate-400">• {sources.length} sources analyzed</span>
      </div>

      {/* Render sections */}
      {sections.map((section, i) => {
        switch (section.type) {
          case 'tldr':
            // Use SummaryCard for old-format summaries that have more content
            if (section.content.length > 300) {
              return <SummaryCard key={i} content={section.content} />
            }
            return <TLDRCard key={i} content={section.content} />
          case 'numbers':
            return <KeyNumbersCard key={i} items={section.items || []} />
          case 'insights':
            return <InsightsCard key={i} insights={section.insights || []} />
          case 'findings':
            return <FindingsCard key={i} insights={section.insights} items={section.items} />
          case 'actions':
          case 'recommendations':
            return <ActionsCard key={i} items={section.items || []} />
          case 'analysis':
            return <AnalysisCard key={i} content={section.content} title={section.title} />
          case 'sources':
            // Sources are rendered by ResearchSourcesPanel
            return null
          default:
            // Render other sections as simple cards
            return (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 font-semibold text-slate-800">{section.title}</h3>
                <div
                  className="prose prose-sm prose-slate max-w-none"
                  dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(section.content) }}
                />
              </div>
            )
        }
      })}
    </div>
  )
}

/**
 * Simple markdown to HTML converter for fallback
 */
function simpleMarkdownToHtml(markdown: string): string {
  return markdown
    // Headers
    .replace(/^### (.+)$/gm, '<h4 class="text-base font-semibold mt-4 mb-2">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="text-lg font-semibold mt-5 mb-3">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="text-xl font-bold mt-6 mb-4">$1</h2>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Bullet points
    .replace(/^[•\-*]\s+(.+)$/gm, '<li class="ml-4">$1</li>')
    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" class="text-blue-600 hover:underline">$1</a>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p class="mb-3">')
    // Wrap in paragraph
    .replace(/^(.+)$/gm, (match) => {
      if (match.startsWith('<')) return match
      return `<p class="mb-3">${match}</p>`
    })
}

export default ResearchNoteRenderer
