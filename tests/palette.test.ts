import { describe, expect, it } from 'vitest'
import { resolveCategorySlots } from '../src/renderer/src/lib/palette'
import { defaultCategories } from '../src/shared/defaults'

describe('resolveCategorySlots', () => {
  it('gives every default expense category its own colour', () => {
    const slots = resolveCategorySlots(defaultCategories())
    const expense = defaultCategories().filter((c) => c.kind === 'expense')
    const used = expense.map((c) => slots.get(c.id))
    expect(new Set(used).size).toBe(expense.length)
  })

  it('moves a later category off a colour that is already taken', () => {
    const slots = resolveCategorySlots([
      { id: 'a', kind: 'expense', color: 1 },
      { id: 'b', kind: 'expense', color: 1 },
      { id: 'c', kind: 'income', color: 1 }
    ])
    expect(slots.get('a')).toBe(1)
    expect(slots.get('b')).toBe(2)
    expect(slots.get('c')).toBe(1)
  })
})
