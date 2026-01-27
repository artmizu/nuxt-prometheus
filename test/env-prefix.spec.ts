import { fileURLToPath } from 'node:url'
import { createPage, setup, useTestContext } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

/**
 * Test: NUXT_PUBLIC_PROMETHEUS_PREFIX env variable
 * Verifies that the metric prefix can be overridden via environment variable.
 */
describe('check NUXT_PUBLIC_PROMETHEUS_PREFIX env variable', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../playground', import.meta.url)),
    env: {
      NUXT_PUBLIC_PROMETHEUS_PREFIX: 'env_prefix_',
    },
  })

  it('should use custom prefix from env variable', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')

    await page.goto(`${ctx.url}`)
    await page.goto(`${ctx.url}metrics`)

    const content = await page.textContent('body')

    // Metrics should have the custom prefix from env variable
    // This overrides the playground's default 'playground_' prefix
    expect(content).toMatch(/env_prefix_process_cpu_user_seconds_total/)
    expect(content).toMatch(/env_prefix_page_render_time/)
  })
})
