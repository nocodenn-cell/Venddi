import { describe, it, expect } from 'vitest'
import { startOfLocalDay, percentChange } from '@/lib/dashboard/metrics'

describe('Dashboard - variação', () => {
  it('calcula variação percentual', () => {
    expect(percentChange(150, 100)).toBe(50)
    expect(percentChange(50, 100)).toBe(-50)
  })

  it('sem base de comparação não inventa variação', () => {
    expect(percentChange(150, 0)).toBeNull()
  })
})

describe('Dashboard - início do dia', () => {
  it('usa 00:00 do dia local', () => {
    const d = startOfLocalDay(new Date(2026, 10, 3, 15, 42))
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
    expect(d.getDate()).toBe(3)
  })
})
