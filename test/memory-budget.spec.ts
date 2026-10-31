import { describe, expect, it } from 'vitest'
import { assessHeap } from '../scripts/memory/heap-budget.mjs'

const mib = 1024 * 1024
const samples = (...sizes: number[]) => sizes.map(size => ({ heapUsed: size * mib }))

describe('post-GC heap budget', () => {
  it('accepts bounded retained heap growth', () => {
    expect(assessHeap(samples(20, 21, 20, 22), 8 * mib).passed).toBe(true)
  })

  it('rejects retained heap growth above the budget', () => {
    expect(assessHeap(samples(20, 24, 28, 32), 8 * mib)).toEqual({
      passed: false,
      growthBytes: 12 * mib,
      limitBytes: 8 * mib,
    })
  })

  it('does not treat a reclaimed heap spike as retained growth', () => {
    expect(assessHeap(samples(20, 40, 21, 20), 8 * mib).passed).toBe(true)
  })

  it('rejects missing or invalid measurements', () => {
    expect(() => assessHeap(samples(20), 8 * mib)).toThrow()
    expect(() => assessHeap([{ heapUsed: Number.NaN }, { heapUsed: 20 * mib }], 8 * mib)).toThrow()
    expect(() => assessHeap(samples(20, 21), 0)).toThrow()
  })
})
