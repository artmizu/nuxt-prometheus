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
        histogramBuckets: [10, 100, 1000],
      },
    },
  })

  it('health page check', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}h`)

    expect(await page.textContent('body')).toContain('ok')
  })

  it('metrics use the custom endpoint and buckets', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}p`)

    const content = await page.textContent('body')
    expect(content).toMatch(/^playground_process_start_time_seconds \d+/gm)
    for (const metric of ['render', 'request', 'total']) {
      const matches = content!.matchAll(new RegExp(`page_${metric}_time_histogram_bucket\\{[^}]*le="([^"]+)"`, 'g'))
      expect([
        ...new Set([...matches].map(match => match[1])),
      ]).toEqual(['10', '100', '1000', '+Inf'])
    }
  })
})
