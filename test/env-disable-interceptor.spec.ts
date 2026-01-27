import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createPage, setup, useTestContext } from '@nuxt/test-utils/e2e'

/**
 * Test: NUXT_PUBLIC_PROMETHEUS_DISABLE_REQUEST_INTERCEPTOR env variable
 * Verifies that request interception can be disabled via environment variable.
 */
describe('NUXT_PUBLIC_PROMETHEUS_DISABLE_REQUEST_INTERCEPTOR env variable', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../playground', import.meta.url)),
    env: {
      NUXT_PUBLIC_PROMETHEUS_DISABLE_REQUEST_INTERCEPTOR: 'true',
    },
  })

  it('should not track external request time when interceptor is disabled via env', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')

    // Visit route /b which makes external requests via useFetch
    await page.goto(`${ctx.url}b`)
    await page.goto(`${ctx.url}metrics`)

    const content = await page.innerText('body')

    // page_request_time should be 0 when interceptor is disabled
    // (the metric exists but external requests are not tracked)
    expect(content).toMatch(/playground_page_request_time\{path="\/b"\} 0/)
  })
})
