export interface NuxtPrometheusState {
  path?: string
  start: number
  requests: Record<string, { start: number; end: number }>
  onRequest?: (event: { request: Request }) => void
  onResponse?: (event: { response: Response }) => void
}

export interface AnalyticsModuleParams {
  /**
   * stdout logs about external requests and render time of the page
   * @default true
   */
  verbose: boolean
  /**
   * To turn on and off the healthcheck route
   * @default true
   */
  healthCheck: boolean
  /**
   * Healthcheck url path
   * @default '/health'
   */
  healthCheckPath: string
  /**
   * Prometheus exporter url path
   * @default '/metrics'
   */
  prometheusPath: string

  /**
   * An optional prefix for metric names.
   *
   * @default no prefix
   */
  prefix?: string

  /**
   * Disable request interception
   * @default false
   */
  disableRequestInterceptor?: boolean
}
