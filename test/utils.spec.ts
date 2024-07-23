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
    interceptor: null,
  })

  expect(time).toEqual({ request: 310, render: 190, total: 500 })
})

