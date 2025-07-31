import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createPage, setup, useTestContext } from '@nuxt/test-utils/e2e'

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
    const content = await page.innerText('body')

    expect(content).toMatch(/page_render_time\{path=\"index: \/\"}\ \d+/gm)
    expect(content).toMatch(/page_render_time\{path=\"a: \/a\"}\ \d+/gm)
    expect(content).toMatch(/page_render_time\{path=\"b: \/b\"}\ \d+/gm)

    expect(content).toMatch(/page_request_time\{path=\"index: \/\"}\ 0/gm)
    expect(content).toMatch(/page_request_time\{path=\"a: \/a\"}\ 0/gm)
    expect(content).toMatch(/page_request_time\{path=\"b: \/b\"}\ 0/gm)

    expect(content).toMatch(/page_total_time\{path=\"index: \/\"}\ \d+/gm)
    expect(content).toMatch(/page_total_time\{path=\"a: \/a\"}\ \d+/gm)
    expect(content).toMatch(/page_total_time\{path=\"b: \/b\"}\ \d+/gm)
  })
})
