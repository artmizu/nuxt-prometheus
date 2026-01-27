import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createPage, setup, useTestContext } from '@nuxt/test-utils/e2e'

describe('disabled module test', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../playground', import.meta.url)),
    nuxtConfig: {
      prometheus: {
        enabled: false,
      },
    },
  })

  it('metrics endpoint should not contain custom page metrics when disabled', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')

    // Visit some pages to generate metrics (if they were being collected)
    await page.goto(`${ctx.url}`)
    await page.goto(`${ctx.url}a`)
    await page.goto(`${ctx.url}metrics`)

    const content = await page.innerText('body')

    // Default Node.js metrics should not be present when module is disabled
    expect(content).not.toMatch(/process_cpu_user_seconds_total/)

    // Custom page metrics should not be present
    expect(content).not.toMatch(/page_render_time/)
    expect(content).not.toMatch(/page_request_time/)
    expect(content).not.toMatch(/page_total_time/)
  })

  it('health endpoint should still work when module is disabled', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}health`)

    expect(await page.innerText('body')).toContain('ok')
  })
})
