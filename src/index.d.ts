import type { NuxtPrometheusState } from './runtime/type'
import 'h3'

declare module 'h3' {
  interface H3EventContext extends Record<string, any> {
    prometheus: NuxtPrometheusState
  }
}
