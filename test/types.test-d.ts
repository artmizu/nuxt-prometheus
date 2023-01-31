import { expectTypeOf, test } from 'vitest'
import type { NuxtConfig } from 'nuxt/config'
import type { AnalyticsModuleParams } from '../src/runtime/type'

test('is module types exist', () => {
  expectTypeOf<Partial<AnalyticsModuleParams>>().toMatchTypeOf<NuxtConfig['prometheus']>()
})
