import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createPage, setup, useTestContext } from '@nuxt/test-utils/e2e'

describe('module tests', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../playground', import.meta.url)),
  })

  it('health page check', async () => {
    const page = await createPage('/health')
    expect(await page.innerText('body')).toContain('ok')
  })

  it('node metrics check', async () => {
    await createPage('/')
    const page = await createPage('/metrics')
    const content = await page.innerText('body')
    expect(content).toMatch(/^playground_process_start_time_seconds\ \d+/gm)
  })

  it('custom metrics check', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}/a`)
    await page.goto(`${ctx.url}/b`)
    await page.goto(`${ctx.url}/metrics`)
    const content = await page.innerText('body')

    expect(content).toMatch(/page_render_time\{path=\"index: \/\"}\ \d+/gm)
    expect(content).toMatch(/page_render_time\{path=\"a: \/a\"}\ \d+/gm)
    expect(content).toMatch(/page_render_time\{path=\"b: \/b\"}\ \d+/gm)

    expect(content).toMatch(/page_request_time\{path=\"index: \/\"}\ \d+/gm)
    expect(content).toMatch(/page_request_time\{path=\"a: \/a\"}\ \d+/gm)
    expect(content).toMatch(/page_request_time\{path=\"b: \/b\"}\ \d+/gm)

    expect(content).toMatch(/page_total_time\{path=\"index: \/\"}\ \d+/gm)
    expect(content).toMatch(/page_total_time\{path=\"a: \/a\"}\ \d+/gm)
    expect(content).toMatch(/page_total_time\{path=\"b: \/b\"}\ \d+/gm)
  })
})
