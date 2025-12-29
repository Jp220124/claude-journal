'use client'

import { useMemo } from 'react'
import { ConnectionLineCoords } from '@/types/annotations'

interface ConnectionLineProps {
  coords: ConnectionLineCoords
  color?: string
  isActive?: boolean
  strokeWidth?: number
}

/**
 * ConnectionLine - SVG curved line connecting anchor text to sticky note
 *
 * Creates a smooth bezier curve from the anchor point to the sticky note.
 * The curve bends horizontally for a natural flow appearance.
 */
export function ConnectionLine({
  coords,
  color = '#F59E0B', // amber-500
  isActive = false,
  strokeWidth = 2,
}: ConnectionLineProps) {
  const { startX, startY, endX, endY } = coords

  // Calculate bezier control points for smooth curve
  const path = useMemo(() => {
    // Calculate the horizontal distance between points
    const dx = endX - startX
    const dy = endY - startY

    // Control point offset - curves more for longer distances
    const curveStrength = Math.min(Math.abs(dx) * 0.5, 100)

    // Control points create a horizontal S-curve
    const cp1x = startX + curveStrength
    const cp1y = startY
    const cp2x = endX - curveStrength
    const cp2y = endY

    return `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`
  }, [startX, startY, endX, endY])

  // Calculate SVG viewBox to contain the entire path with padding
  const bounds = useMemo(() => {
    const padding = 20
    const minX = Math.min(startX, endX) - padding
    const minY = Math.min(startY, endY) - padding
    const maxX = Math.max(startX, endX) + padding
    const maxY = Math.max(startY, endY) + padding

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    }
  }, [startX, startY, endX, endY])

  return (
    <svg
      className="absolute pointer-events-none"
      style={{
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        overflow: 'visible',
      }}
    >
      {/* Glow effect when active */}
      {isActive && (
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}

      {/* Main connection line */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={isActive ? strokeWidth + 1 : strokeWidth}
        strokeLinecap="round"
        strokeDasharray={isActive ? 'none' : '6 4'}
        opacity={isActive ? 1 : 0.7}
        filter={isActive ? 'url(#glow)' : undefined}
        className="transition-all duration-200"
      />

      {/* Start point indicator (at anchor) */}
      <circle
        cx={startX}
        cy={startY}
        r={isActive ? 5 : 4}
        fill={color}
        opacity={isActive ? 1 : 0.8}
        className="transition-all duration-200"
      />

      {/* End point indicator (at sticky note) */}
      <circle
        cx={endX}
        cy={endY}
        r={isActive ? 4 : 3}
        fill={color}
        opacity={isActive ? 1 : 0.6}
        className="transition-all duration-200"
      />
    </svg>
  )
}

export default ConnectionLine
