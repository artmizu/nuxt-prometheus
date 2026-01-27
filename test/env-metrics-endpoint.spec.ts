import { fileURLToPath } from 'node:url'
import { createPage, setup, useTestContext } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

/**
 * Test: NUXT_PUBLIC_PROMETHEUS_METRICS_ENDPOINT env variable
 * Verifies that the metrics endpoint can be disabled via environment variable
 * while still collecting metrics internally.
 */
describe('check NUXT_PUBLIC_PROMETHEUS_METRICS_ENDPOINT env variable', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../playground', import.meta.url)),
    env: {
      NUXT_PUBLIC_PROMETHEUS_METRICS_ENDPOINT: 'false',
    },
  })

  it('should return 404 when metrics endpoint is disabled via env', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}metrics`)

    expect(await page.textContent('body')).toContain('404')
  })

  it('health endpoint should still work when metrics endpoint is disabled', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}health`)

    expect(await page.textContent('body')).toContain('ok')
  })
})
