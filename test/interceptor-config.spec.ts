import type { NuxtConfig } from '@nuxt/schema'
import { fileURLToPath } from 'node:url'
import { loadNuxt } from '@nuxt/kit'
import { describe, expect, it } from 'vitest'

describe('interceptor async context config', () => {
  it.each<{ name: string, config: NuxtConfig, expected: boolean | undefined }>([
    {
      name: 'preserves an explicit opt-out',
      config: { nitro: { experimental: { asyncContext: false } } },
      expected: false,
    },
    {
      name: 'does not enable context when interception is disabled',
      config: { prometheus: { disableRequestInterceptor: true } },
      expected: undefined,
    },
    {
      name: 'does not enable context when the module is disabled',
      config: { prometheus: { enabled: false } },
      expected: undefined,
    },
  ])('$name', async ({ config, expected }) => {
    const nuxt = await loadNuxt({
      cwd: fileURLToPath(new URL('./fixtures/interceptor', import.meta.url)),
      dev: false,
      overrides: config,
    })
    try {
      expect(nuxt.options.nitro.experimental?.asyncContext).toBe(expected)
    }
    finally {
      await nuxt.close()
    }
  })
})
