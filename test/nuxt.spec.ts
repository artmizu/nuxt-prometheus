import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createPage, setup, useTestContext } from '@nuxt/test-utils/e2e'

describe('module tests', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../playground', import.meta.url)),
  })

  it('health page check', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}health`)

    expect(await page.innerText('body')).toContain('ok')
  })

  it('node metrics check', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}metrics`)

    const content = await page.innerText('body')
    expect(content).toMatch(/^playground_process_start_time_seconds\ \d+/gm)
  })

  it('custom metrics check', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}a`)
    await page.goto(`${ctx.url}b`)
    await page.goto(`${ctx.url}metrics`)
    const content = await page.innerText('body')

    expect(content).toMatch(/page_render_time\{path=\"\/\"}\ \d+/gm)
    expect(content).toMatch(/page_render_time\{path=\"\/a\"}\ \d+/gm)
    expect(content).toMatch(/page_render_time\{path=\"\/b\"}\ \d+/gm)

    expect(content).toMatch(/page_request_time\{path=\"\/\"}\ \d+/gm)
    expect(content).toMatch(/page_request_time\{path=\"\/a\"}\ \d+/gm)
    expect(content).toMatch(/page_request_time\{path=\"\/b\"}\ \d+/gm)

    expect(content).toMatch(/page_total_time\{path=\"\/\"}\ \d+/gm)
    expect(content).toMatch(/page_total_time\{path=\"\/a\"}\ \d+/gm)
    expect(content).toMatch(/page_total_time\{path=\"\/b\"}\ \d+/gm)
  })

  it('check the useFetch measuring time on /b route', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}b`)
    await page.goto(`${ctx.url}metrics`)
    const content = await page.innerText('body')

    expect(content).toMatch(/page_request_time\{path=\"\/b\"}\ [1-9]+/gm)
  })

  it('check the native fetch measuring time on /c route', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}c`)
    await page.goto(`${ctx.url}metrics`)
    const content = await page.innerText('body')

    expect(content).toMatch(/page_request_time\{path=\"\/c\"}\ [1-9]+/gm)
  })

  it('check server route without external requests', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}api/plain`)
    await page.goto(`${ctx.url}api/plain/sample`)
    await page.goto(`${ctx.url}metrics`)
    const content = await page.innerText('body')

    expect(content).toMatch(/page_render_time\{path=\"\/api\/plain\"}\ \d+/gm)
    expect(content).toMatch(/page_render_time\{path=\"\/api\/plain\/\:id\"}\ \d+/gm)
  })

  it('check server route with external requests', async () => {
    const ctx = useTestContext()
    const page = await createPage('/')
    await page.goto(`${ctx.url}api/complex`)
    await page.goto(`${ctx.url}api/complex/sample`)
    await page.goto(`${ctx.url}metrics`)
    const content = await page.innerText('body')

    expect(content).toMatch(/page_render_time\{path=\"\/api\/complex\"}\ \d+/gm)
    expect(content).toMatch(/page_render_time\{path=\"\/api\/complex\/\:id\"}\ \d+/gm)

    expect(content).toMatch(/page_request_time\{path=\"\/api\/complex\"}\ \d+/gm)
    expect(content).toMatch(/page_request_time\{path=\"\/api\/complex\/\:id\"}\ \d+/gm)

    expect(content).toMatch(/page_total_time\{path=\"\/api\/complex\"}\ \d+/gm)
    expect(content).toMatch(/page_total_time\{path=\"\/api\/complex\/\:id\"}\ \d+/gm)
  })
})
