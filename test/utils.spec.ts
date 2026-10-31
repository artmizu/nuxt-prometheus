import { expect, it, vi } from 'vitest'
import { calculateTime } from '../src/runtime/utils'

it('calculateTime check', () => {
  const startTime = Date.now()
  vi.setSystemTime(startTime + 500)

  const time = calculateTime({
    path: '/',
    start: startTime,
    requests: {
      '/a': {
        start: 0,
        end: 100,
      },
      '/b': {
        start: 50,
        end: 150,
      },
      '/c': {
        start: 200,
        end: 250,
      },
      '/d': {
        start: 300,
        end: 400,
      },
      '/e': {
        start: 310,
        end: 410,
      },
    },
  })

  expect(time).toEqual({ request: 310, render: 190, total: 500 })
})

it('calculateTime ignores engine key ordering', () => {
  const startTime = Date.now()
  vi.setSystemTime(startTime + 500)

  const requests: Record<string, { start: number, end: number }> = {}
  requests[8] = { start: 300, end: 400 }
  requests.f = { start: 0, end: 100 }

  expect(Object.keys(requests)).toEqual(['8', 'f'])
  expect(calculateTime({ path: '/', start: startTime, requests })).toEqual({ request: 200, render: 300, total: 500 })
})
