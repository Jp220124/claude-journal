import { Mark, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    stickyAnchor: {
      /**
       * Set a sticky anchor mark on the selected text
       */
      setStickyAnchor: (anchorId?: string) => ReturnType
      /**
       * Remove a sticky anchor mark by ID
       */
      removeStickyAnchor: (anchorId: string) => ReturnType
      /**
       * Remove all sticky anchor marks from selection
       */
      unsetStickyAnchor: () => ReturnType
    }
  }
}

export interface StickyAnchorOptions {
  HTMLAttributes: Record<string, string>
  onAnchorCreate?: (anchorId: string, anchorText: string) => void
  onAnchorRemove?: (anchorId: string) => void
}

/**
 * StickyAnchorMark - A TipTap Mark extension for sticky note anchors
 *
 * This mark highlights text and associates it with a sticky note via a unique anchor ID.
 * The anchor ID is stored as a data attribute and used to connect the text with
 * its corresponding sticky note annotation.
 */
export const StickyAnchorMark = Mark.create<StickyAnchorOptions>({
  name: 'stickyAnchor',

  priority: 1000,

  // IMPORTANT: Set inclusive to false so typing at the end of the anchor
  // doesn't extend the mark to the new text
  inclusive: false,

  addOptions() {
    return {
      HTMLAttributes: {},
      onAnchorCreate: undefined,
      onAnchorRemove: undefined,
    }
  },

  addAttributes() {
    return {
      'data-sticky-anchor-id': {
        default: null,
        parseHTML: element => element.getAttribute('data-sticky-anchor-id'),
        renderHTML: attributes => {
          if (!attributes['data-sticky-anchor-id']) {
            return {}
          }
          return {
            'data-sticky-anchor-id': attributes['data-sticky-anchor-id'],
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-sticky-anchor-id]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'sticky-anchor',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setStickyAnchor:
        (anchorId?: string) =>
        ({ commands, state }) => {
          const { selection } = state
          const { from, to } = selection

          // Don't allow empty selections
          if (from === to) {
            return false
          }

          const id = anchorId || crypto.randomUUID()
          const anchorText = state.doc.textBetween(from, to, ' ')

          const result = commands.setMark(this.name, {
            'data-sticky-anchor-id': id,
          })

          // Trigger callback if provided
          if (result && this.options.onAnchorCreate) {
            this.options.onAnchorCreate(id, anchorText)
          }

          return result
        },

      removeStickyAnchor:
        (anchorId: string) =>
        ({ tr, state, dispatch }) => {
          const { doc } = state
          let removed = false

          doc.descendants((node, pos) => {
            if (node.isText) {
              const marks = node.marks.filter(
                mark =>
                  mark.type.name === this.name &&
                  mark.attrs['data-sticky-anchor-id'] === anchorId
              )

              if (marks.length > 0) {
                marks.forEach(mark => {
                  tr.removeMark(pos, pos + node.nodeSize, mark.type)
                })
                removed = true
              }
            }
          })

          if (removed && dispatch) {
            dispatch(tr)
            // Trigger callback if provided
            if (this.options.onAnchorRemove) {
              this.options.onAnchorRemove(anchorId)
            }
          }

          return removed
        },

      unsetStickyAnchor:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name)
        },
    }
  },

  // Add keyboard shortcut to create sticky anchor
  addKeyboardShortcuts() {
    return {
      // Alt+S to create sticky anchor (will be triggered by toolbar too)
      'Alt-s': () => this.editor.commands.setStickyAnchor(),
    }
  },
})

export default StickyAnchorMark
