import type { BatchInterceptor, HttpRequestEventMap } from '@mswjs/interceptors'
import type { ClientRequestInterceptor } from '@mswjs/interceptors/lib/interceptors/ClientRequest'
import type { XMLHttpRequestInterceptor } from '@mswjs/interceptors/lib/interceptors/XMLHttpRequest'

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
}
