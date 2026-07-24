import type { NuxtPrometheusState } from '../src/runtime/type'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  bindInterceptor,
  interceptor,
  interceptorListenerCount,
  requestContext,
  resetInterceptorForTests,
} from '../src/runtime/interceptor'

function newState(): NuxtPrometheusState {
  return { start: Date.now(), requests: {} }
}

beforeEach(() => {
  resetInterceptorForTests()
  interceptor.apply()
})

// Before: the original design attached a listener per request and detached it
// only from the afterResponse/error hooks, leaking any request that skipped them.
describe('regression: per-request listeners leaked (original behaviour)', () => {
  it('accumulates listeners when per-request cleanup does not run', () => {
    // One `on` fans out across the sub-interceptors; measure the per-listener cost.
    const base = interceptorListenerCount('request')
    const probe = (): void => {}
    interceptor.on('request', probe)
    const perListener = interceptorListenerCount('request') - base
    interceptor.off('request', probe)

    const start = interceptorListenerCount('request')

    // 100 requests attach a listener like the old hook did; 3 in 10 never reach
    // cleanup (aborted connection, hijacked/streamed response, early error).
    for (let i = 0; i < 100; i++) {
      const listener = (): void => {}
      interceptor.on('request', listener)
      if (i % 10 < 7)
        interceptor.off('request', listener)
    }

    expect(interceptorListenerCount('request') - start).toBe(30 * perListener)

    resetInterceptorForTests()
  })
})

// After: a single listener pair is bound once and the active request is
// resolved from async context.
describe('fixed: interceptor is bound once and does not leak under load', () => {
  it('registers a single listener pair regardless of request volume', async () => {
    bindInterceptor()
    const boundRequest = interceptorListenerCount('request')
    const boundResponse = interceptorListenerCount('response')

    expect(boundRequest).toBeGreaterThan(0)

    for (let i = 0; i < 1000; i++)
      await requestContext.run(newState(), async () => {})

    // Repeated plugin init must stay a no-op.
    bindInterceptor()
    bindInterceptor({ verbose: true })

    expect(interceptorListenerCount('request')).toBe(boundRequest)
    expect(interceptorListenerCount('response')).toBe(boundResponse)
  })

  it('attributes an outbound request to the active request context', async () => {
    bindInterceptor()
    // Resolve locally so the test never hits the network.
    interceptor.on('request', ({ controller }: { controller: { respondWith: (r: Response) => void } }) => {
      controller.respondWith(new Response('ok'))
    })

    const state = newState()
    await requestContext.run(state, async () => {
      await fetch('http://api.test/v1/flights')
    })

    expect(Object.keys(state.requests)).toContain('http://api.test/v1/flights')
    const record = state.requests['http://api.test/v1/flights']
    expect(record).toBeDefined()
    if (record)
      expect(record.end).toBeGreaterThanOrEqual(record.start)
  })

  it('does not cross-record outbound calls between concurrent requests', async () => {
    bindInterceptor()
    interceptor.on('request', ({ controller }: { controller: { respondWith: (r: Response) => void } }) => {
      controller.respondWith(new Response('ok'))
    })

    const a = newState()
    const b = newState()

    await Promise.all([
      requestContext.run(a, () => fetch('http://api.test/a')),
      requestContext.run(b, () => fetch('http://api.test/b')),
    ])

    expect(Object.keys(a.requests)).toEqual(['http://api.test/a'])
    expect(Object.keys(b.requests)).toEqual(['http://api.test/b'])
  })

  it('ignores internal Nuxt (/__*) outbound requests', async () => {
    bindInterceptor()
    interceptor.on('request', ({ controller }: { controller: { respondWith: (r: Response) => void } }) => {
      controller.respondWith(new Response('ok'))
    })

    const state = newState()
    await requestContext.run(state, async () => {
      await fetch('http://api.test/__nuxt_island/foo')
    })

    expect(Object.keys(state.requests)).toHaveLength(0)
  })
})
