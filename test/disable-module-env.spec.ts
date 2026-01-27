import { fileURLToPath } from 'node:url'
import { createPage, setup, useTestContext } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

describe('disabled module via env variable test', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../playground', import.meta.url)),
    env: {
      // Nuxt runtime config can be overridden via NUXT_PUBLIC_* env variables
      NUXT_PUBLIC_PROMETHEUS_ENABLED: 'false',
    },
  })

  it('metrics should not be collected when disabled via env variable', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')

    // Visit some pages to generate metrics (if they were being collected)
    await page.goto(`${ctx.url}`)
    await page.goto(`${ctx.url}a`)
    await page.goto(`${ctx.url}metrics`)

    const content = await page.textContent('body')

    // Default Node.js metrics should not be present when module is disabled
    expect(content).not.toMatch(/process_cpu_user_seconds_total/)

    // Custom page metrics should not be present
    expect(content).not.toMatch(/page_render_time/)
    expect(content).not.toMatch(/page_request_time/)
    expect(content).not.toMatch(/page_total_time/)
  })

  it('health endpoint should still work when module is disabled via env', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}health`)

    expect(await page.textContent('body')).toContain('ok')
  })
})
