import { Gauge } from 'prom-client'

const renderTime = new Gauge({
  name: 'page_render_time',
  help: 'page_render_time_help',
  labelNames: ['path'],
})

const requestTime = new Gauge({
  name: 'page_request_time',
  help: 'page_request_time_help',
  labelNames: ['path'],
})

const totalTime = new Gauge({
  name: 'page_total_time',
  help: 'page_total_time_help',
  labelNames: ['path'],
})

export { renderTime, requestTime, totalTime }
