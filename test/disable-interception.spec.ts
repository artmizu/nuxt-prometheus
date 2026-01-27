import { fileURLToPath } from 'node:url'
import { createPage, setup, useTestContext } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

describe('interception is disabled', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../playground', import.meta.url)),
    nuxtConfig: {
      prometheus: {
        disableRequestInterceptor: true,
      },
    },
  })

  it('requests are not intercepted', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}a`)
    await page.goto(`${ctx.url}b`)
    await page.goto(`${ctx.url}metrics`)
    const content = await page.textContent('body')

    expect(content).toMatch(/page_render_time\{path="\/"\} \d+/g)
    expect(content).toMatch(/page_render_time\{path="\/a"\} \d+/g)
    expect(content).toMatch(/page_render_time\{path="\/b"\} \d+/g)

    expect(content).toMatch(/page_request_time\{path="\/"\} 0/g)
    expect(content).toMatch(/page_request_time\{path="\/a"\} 0/g)
    expect(content).toMatch(/page_request_time\{path="\/b"\} 0/g)

    expect(content).toMatch(/page_total_time\{path="\/"\} \d+/g)
    expect(content).toMatch(/page_total_time\{path="\/a"\} \d+/g)
    expect(content).toMatch(/page_total_time\{path="\/b"\} \d+/g)
  })
})
