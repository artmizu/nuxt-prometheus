import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createPage, setup, useTestContext } from '@nuxt/test-utils/e2e'

/**
 * Test: NUXT_PUBLIC_PROMETHEUS_HEALTH_CHECK env variable
 * Verifies that the health check endpoint can be disabled via environment variable.
 */
describe('NUXT_PUBLIC_PROMETHEUS_HEALTH_CHECK env variable', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../playground', import.meta.url)),
    env: {
      NUXT_PUBLIC_PROMETHEUS_HEALTH_CHECK: 'false',
    },
  })

  it('should return 404 when health check is disabled via env', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}health`)

    expect(await page.innerText('body')).toContain('404')
  })

  it('metrics endpoint should still work when health check is disabled', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}metrics`)

    const content = await page.innerText('body')
    expect(content).toMatch(/process_cpu_user_seconds_total/)
  })
})
