import type { NuxtConfig } from 'nuxt/config'
import type { AnalyticsModuleParams } from '../src/runtime/type'
import { expectTypeOf, test } from 'vitest'

test('module types match NuxtConfig', () => {
  expectTypeOf<Partial<AnalyticsModuleParams>>().toMatchTypeOf<NuxtConfig['prometheus']>()
})

test('AnalyticsModuleParams has correct property types', () => {
  // Boolean properties
  expectTypeOf<AnalyticsModuleParams['enabled']>().toEqualTypeOf<boolean | undefined>()
  expectTypeOf<AnalyticsModuleParams['verbose']>().toEqualTypeOf<boolean>()
  expectTypeOf<AnalyticsModuleParams['healthCheck']>().toEqualTypeOf<boolean>()
  expectTypeOf<AnalyticsModuleParams['disableRequestInterceptor']>().toEqualTypeOf<boolean | undefined>()
  expectTypeOf<AnalyticsModuleParams['metricsEndpoint']>().toEqualTypeOf<boolean | undefined>()

  // String properties
  expectTypeOf<AnalyticsModuleParams['healthCheckPath']>().toEqualTypeOf<string>()
  expectTypeOf<AnalyticsModuleParams['prometheusPath']>().toEqualTypeOf<string>()
  expectTypeOf<AnalyticsModuleParams['prefix']>().toEqualTypeOf<string | undefined>()
})

test('config is assignable with all options', () => {
  const config: Partial<AnalyticsModuleParams> = {
    enabled: true,
    verbose: false,
    healthCheck: true,
    healthCheckPath: '/health',
    prometheusPath: '/metrics',
    prefix: 'myapp_',
    disableRequestInterceptor: false,
    metricsEndpoint: true,
  }
  expectTypeOf(config).toMatchTypeOf<Partial<AnalyticsModuleParams>>()
})

test('config is assignable with minimal options', () => {
  const minimalConfig: Partial<AnalyticsModuleParams> = {}
  expectTypeOf(minimalConfig).toMatchTypeOf<Partial<AnalyticsModuleParams>>()
})
