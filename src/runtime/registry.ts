import type { AnalyticsModuleParams } from './type'
import { collectDefaultMetrics, Gauge, Histogram, register } from '@prometheus-io/client'

export const metrics = {
  /** If `true`, metrics was initialized with `initMetrics` */
  isInitialized: false,

  // Gauge
  renderTime: null as Gauge | null,
  requestTime: null as Gauge | null,
  totalTime: null as Gauge | null,

  renderTimeHistogram: null as Histogram<'path'> | null,
  requestTimeHistogram: null as Histogram<'path'> | null,
  totalTimeHistogram: null as Histogram<'path'> | null,
}

export function initMetrics(p: Partial<AnalyticsModuleParams>) {
  if (metrics.isInitialized)
    return

  const configuredBuckets = p.histogramBuckets ?? []
  if (!Array.isArray(configuredBuckets) || Array.from(configuredBuckets).some((bucket, index) => !Number.isFinite(bucket) || bucket < 0 || (index > 0 && bucket <= configuredBuckets[index - 1]!)))
    throw new TypeError('histogramBuckets must contain finite, non-negative numbers in strictly increasing order')

  const buckets = configuredBuckets.length
    ? configuredBuckets
    : [
        5,
        10,
        25,
        50,
        100,
        250,
        500,
        1000,
        2500,
        5000,
        10000,
      ]

  collectDefaultMetrics({
    prefix: p.prefix,
    register,
  })

  const prefix = p.prefix ?? ''

  metrics.renderTime = new Gauge({
    name: `${prefix}page_render_time`,
    help: 'Time took to render a page',
    labelNames: ['path'],
  })

  metrics.requestTime = new Gauge({
    name: `${prefix}page_request_time`,
    help: 'Time took to process a request, before rendering page',
    labelNames: ['path'],
  })

  metrics.totalTime = new Gauge({
    name: `${prefix}page_total_time`,
    help: 'Total time it took to complete a request',
    labelNames: ['path'],
  })

  metrics.renderTimeHistogram = new Histogram({
    name: `${prefix}page_render_time_histogram`,
    help: 'Time took to render a page',
    labelNames: ['path'],
    buckets: [...buckets],
  })

  metrics.requestTimeHistogram = new Histogram({
    name: `${prefix}page_request_time_histogram`,
    help: 'Time took to process a request, before rendering page',
    labelNames: ['path'],
    buckets: [...buckets],
  })

  metrics.totalTimeHistogram = new Histogram({
    name: `${prefix}page_total_time_histogram`,
    help: 'Total time it took to complete a request',
    labelNames: ['path'],
    buckets: [...buckets],
  })

  metrics.isInitialized = true
}
