import { NEUTRAL_SLOT } from '@shared/defaults'

/** Categorical chart palette, validated for colour-vision deficiencies in both themes. */
const LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
const DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']

export const OTHER_LIGHT = '#a8a69f'
export const OTHER_DARK = '#5f5e5a'

// The neutral grey slot (for "Sonstiges") may repeat and is never moved.
export { NEUTRAL_SLOT }

export function seriesColor(index: number, dark: boolean): string {
  if (index === NEUTRAL_SLOT) return otherColor(dark)
  const list = dark ? DARK : LIGHT
  return list[((index % list.length) + list.length) % list.length]
}

export function otherColor(dark: boolean): string {
  return dark ? OTHER_DARK : OTHER_LIGHT
}

export const PALETTE_SIZE = LIGHT.length

/**
 * Gives every category a palette slot. A category keeps its chosen slot unless
 * an earlier category of the same kind already uses it; then it moves to the
 * next free slot, so colours stay distinct and identical on every page. Only
 * when all slots are taken do colours repeat.
 */
export function resolveCategorySlots(categories: Array<{ id: string; kind: string; color: number }>): Map<string, number> {
  const result = new Map<string, number>()
  const used = new Map<string, Set<number>>()
  for (const c of categories) {
    const taken = used.get(c.kind) ?? new Set<number>()
    used.set(c.kind, taken)
    let slot = c.color
    if (slot !== NEUTRAL_SLOT && taken.has(slot) && taken.size < PALETTE_SIZE) {
      for (let i = 1; i < PALETTE_SIZE; i++) {
        const candidate = (c.color + i) % PALETTE_SIZE
        if (!taken.has(candidate)) {
          slot = candidate
          break
        }
      }
    }
    taken.add(slot)
    result.set(c.id, slot)
  }
  return result
}
