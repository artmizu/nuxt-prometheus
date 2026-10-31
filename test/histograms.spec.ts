import { register } from '@prometheus-io/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initMetrics, metrics } from '../src/runtime/registry'

beforeEach(() => {
  register.clear()
  metrics.isInitialized = false
})

afterEach(() => {
  register.clear()
})

describe('page timing histograms', () => {
  it('registers histograms in milliseconds without page summaries', async () => {
    initMetrics({ prefix: 'test_' })

    const pageMetrics = (await register.getMetricsAsJSON()).filter(metric => metric.name.startsWith('test_page_'))
    expect(pageMetrics.filter(metric => metric.type === 'histogram').map(metric => metric.name)).toEqual([
      'test_page_render_time_histogram',
      'test_page_request_time_histogram',
      'test_page_total_time_histogram',
    ])
    expect(pageMetrics.filter(metric => metric.type === 'summary')).toEqual([])
    expect(pageMetrics.filter(metric => metric.type === 'gauge')).toHaveLength(3)

    metrics.totalTimeHistogram!.labels('/a').observe(70)
    const histogram = await metrics.totalTimeHistogram!.get()
    expect(histogram.values).toContainEqual(expect.objectContaining({
      labels: { path: '/a', le: 50 },
      value: 0,
    }))
    expect(histogram.values).toContainEqual(expect.objectContaining({
      labels: { path: '/a', le: 100 },
      value: 1,
    }))
    expect(histogram.values).toContainEqual(expect.objectContaining({ metricName: 'test_page_total_time_histogram_sum', value: 70 }))
    expect(histogram.values).toContainEqual(expect.objectContaining({ metricName: 'test_page_total_time_histogram_count', value: 1 }))
  })

  it('applies custom buckets to every histogram', async () => {
    const histogramBuckets = [10, 100, 1000]
    initMetrics({ histogramBuckets })

    for (const histogram of [metrics.renderTimeHistogram, metrics.requestTimeHistogram, metrics.totalTimeHistogram])
      histogram!.labels('/a').observe(75)

    const histograms = (await register.getMetricsAsJSON()).filter(metric => metric.type === 'histogram' && metric.name.startsWith('page_'))
    expect(histograms).toHaveLength(3)
    for (const histogram of histograms) {
      const buckets = histogram.values.filter(value => Object.hasOwn(value.labels, 'le'))
      expect(buckets.map(value => value.labels.le)).toEqual([10, 100, 1000, '+Inf'])
      expect(buckets.map(value => value.value)).toEqual([0, 1, 1, 1])
    }
  })

  it.each([
    [-1, 10],
    [10, 10],
    [100, 10],
    [10, Number.POSITIVE_INFINITY],
  ])('rejects invalid bucket boundaries %j', (...histogramBuckets) => {
    expect(() => initMetrics({ histogramBuckets })).toThrow('histogramBuckets')
  })
})
