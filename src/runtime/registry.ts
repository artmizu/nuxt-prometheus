import { Gauge, collectDefaultMetrics, register } from 'prom-client'
import type { AnalyticsModuleParams } from './type'

const metrics = {
  renderTime: null as Gauge | null,
  requestTime: null as Gauge | null,
  totalTime: null as Gauge | null,
}

export const renderTime = metrics.renderTime
export const requestTime = metrics.requestTime
export const totalTime = metrics.totalTime

export const initMetrics = (p: Partial<AnalyticsModuleParams>) => {

  console.log('init metrics')

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
}

