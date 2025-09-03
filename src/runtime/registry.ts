import { Gauge, Summary, collectDefaultMetrics, register } from 'prom-client'
import type { AnalyticsModuleParams } from './type'

export const metrics = {
  /** If `true`, metrics was initialized with `initMetrics` */
  isInitialized: false,

  // Gauge
  renderTime: null as Gauge | null,
  requestTime: null as Gauge | null,
  totalTime: null as Gauge | null,

  // Summary
  renderTimeSummary: null as Summary | null,
  requestTimeSummary: null as Summary | null,
  totalTimeSummary: null as Summary | null,
}

export const initMetrics = (p: Partial<AnalyticsModuleParams>) => {
  if (metrics.isInitialized)
    return

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

  metrics.renderTimeSummary = new Summary({
    name: `${prefix}page_render_time_summary`,
    help: 'Time took to render a page',
    labelNames: ['path'],
  })

  metrics.requestTimeSummary = new Summary({
    name: `${prefix}page_request_time_summary`,
    help: 'Time took to process a request, before rendering page',
    labelNames: ['path'],
  })

  metrics.totalTimeSummary = new Summary({
    name: `${prefix}page_total_time_summary`,
    help: 'Total time it took to complete a request',
    labelNames: ['path'],
  })

  metrics.isInitialized = true
}

