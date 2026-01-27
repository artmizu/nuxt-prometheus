import { fileURLToPath } from 'node:url'
import { createPage, setup, useTestContext } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

describe('custom module params test', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../playground', import.meta.url)),
    nuxtConfig: {
      prometheus: {
        healthCheckPath: '/h',
        prometheusPath: '/p',
      },
    },
  })

  it('health page check', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}h`)

    expect(await page.textContent('body')).toContain('ok')
  })

  it('node metrics check', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}p`)

    const content = await page.textContent('body')
    expect(content).toMatch(/^playground_process_start_time_seconds \d+/gm)
  })
})
