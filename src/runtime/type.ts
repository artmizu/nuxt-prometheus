import type { BatchInterceptor, HttpRequestEventMap } from '@mswjs/interceptors'
import type { XMLHttpRequestInterceptor } from '@mswjs/interceptors/XMLHttpRequest'
import type { ClientRequestInterceptor } from '@mswjs/interceptors/ClientRequest'

export interface AnalyticsModuleState {
  path: string
  start: number
  requests: {
    [key: string]: {
      start: number
      end: number
    }
  }
  interceptor?: BatchInterceptor<(ClientRequestInterceptor | XMLHttpRequestInterceptor)[], HttpRequestEventMap>
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
   * Pormetheus exporter url path
   * @default '/metrics'
   */
  prometheusPath: string
}
