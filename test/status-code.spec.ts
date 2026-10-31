import type { H3Event } from 'h3'
import { register } from '@prometheus-io/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initMetrics, metrics } from '../src/runtime/registry'
import { resolveResponseStatus } from '../src/runtime/utils'

interface EventOptions {
  path: string
  statusCode: number
  renderingError?: boolean
}

function makeEvent(options: EventOptions): H3Event {
  const req: Record<string, unknown> = {}
  if (options.renderingError) {
    req.__unenv__ = {
      nuxt: {
        '~rendering-error': true,
      },
    }
  }

  return {
    path: options.path,
    node: {
      req,
      res: {
        statusCode: options.statusCode,
      },
    },
    context: {},
  } as unknown as H3Event
}

beforeEach(() => {
  register.clear()
  metrics.isInitialized = false
})

afterEach(() => {
  register.clear()
})

describe('resolveResponseStatus', () => {
  it('returns node response status when no internal fetch marker exists', () => {
    const event = makeEvent({ path: '/a', statusCode: 200 })
    expect(resolveResponseStatus(event, '/a')).toBe('200')
  })

  it('returns statusCode query value for an internal error re-render', () => {
    const event = makeEvent({ path: '/__nuxt_error?statusCode=500', statusCode: 200, renderingError: true })
    expect(resolveResponseStatus(event, '/__nuxt_error')).toBe('500')
  })

  it('falls back to node status for internal re-render without statusCode query', () => {
    const event = makeEvent({ path: '/__nuxt_error', statusCode: 200, renderingError: true })
    expect(resolveResponseStatus(event, '/__nuxt_error')).toBe('200')
  })

  it('rejects an out-of-range statusCode query value', () => {
    const event = makeEvent({ path: '/__nuxt_error?statusCode=9999', statusCode: 200, renderingError: true })
    expect(resolveResponseStatus(event, '/__nuxt_error')).toBe('200')
  })

  it('rejects a non-numeric statusCode query value', () => {
    const event = makeEvent({ path: '/__nuxt_error?statusCode=abc', statusCode: 200, renderingError: true })
    expect(resolveResponseStatus(event, '/__nuxt_error')).toBe('200')
  })

  it('ignores internal marker when the recorded path is not the error route', () => {
    const event = makeEvent({ path: '/some-page?statusCode=418', statusCode: 200, renderingError: true })
    expect(resolveResponseStatus(event, '/some-page')).toBe('200')
  })

  it('ignores spoofed statusCode query when only the outer context flag is set', () => {
    const event = {
      path: '/error?statusCode=418',
      node: {
        req: {},
        res: { statusCode: 500 },
      },
      context: {
        nuxt: { '~rendering-error': true },
      },
    } as unknown as H3Event
    expect(resolveResponseStatus(event, '/error')).toBe('500')
  })

  it('ignores statusCode query on error route when internal fetch marker is absent', () => {
    const event = makeEvent({ path: '/__nuxt_error?statusCode=999', statusCode: 404 })
    expect(resolveResponseStatus(event, '/__nuxt_error')).toBe('404')
  })
})

describe('page timing status_code label', () => {
  it('records a series with both path and status_code labels on all six page metrics', async () => {
    initMetrics({ prefix: 'test_' })

    metrics.totalTime!.labels('/a', '503').set(10)
    metrics.totalTimeHistogram!.labels('/a', '503').observe(10)
    metrics.renderTime!.labels('/a', '503').set(5)
    metrics.renderTimeHistogram!.labels('/a', '503').observe(5)
    metrics.requestTime!.labels('/a', '503').set(5)
    metrics.requestTimeHistogram!.labels('/a', '503').observe(5)

    const pageMetrics = (await register.getMetricsAsJSON()).filter(metric => metric.name.startsWith('test_page_'))
    expect(pageMetrics.map(metric => metric.name).sort()).toEqual([
      'test_page_render_time',
      'test_page_render_time_histogram',
      'test_page_request_time',
      'test_page_request_time_histogram',
      'test_page_total_time',
      'test_page_total_time_histogram',
    ])

    for (const metric of pageMetrics) {
      const sample = metric.values.find(value => Object.hasOwn(value.labels, 'path'))
      expect(sample?.labels).toMatchObject({ path: '/a', status_code: '503' })
    }
  })

  it('keeps status_code on total metrics when request interception is disabled', async () => {
    initMetrics({ prefix: 'test_', disableRequestInterceptor: true })

    metrics.totalTime!.labels('/b', '404').set(20)
    metrics.totalTimeHistogram!.labels('/b', '404').observe(20)

    const pageMetrics = (await register.getMetricsAsJSON()).filter(metric => metric.name.startsWith('test_page_'))
    expect(pageMetrics.map(metric => metric.name).sort()).toEqual([
      'test_page_total_time',
      'test_page_total_time_histogram',
    ])

    for (const metric of pageMetrics) {
      const sample = metric.values.find(value => Object.hasOwn(value.labels, 'path'))
      expect(sample?.labels).toMatchObject({ path: '/b', status_code: '404' })
    }
  })
})
