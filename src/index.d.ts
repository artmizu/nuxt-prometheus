import 'h3';
import type { NuxtPrometheusState } from './runtime/type';

declare module 'h3' {
  interface H3EventContext extends Record<string, any> {
    prometheus: NuxtPrometheusState
  }
}