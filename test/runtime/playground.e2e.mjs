import assert from 'node:assert/strict'
import net from 'node:net'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const isBun = typeof globalThis.Bun !== 'undefined'
const isDeno = !isBun && typeof globalThis.Deno !== 'undefined'

const outputDir = fileURLToPath(new URL('../../playground/.output', import.meta.url))

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => resolve(address.port))
    })
  })
}

function startServer(port) {
  const env = {
    ...process.env,
    PORT: String(port),
    NITRO_PORT: String(port),
  }
  const options = {
    cwd: outputDir,
    env,
    stdout: 'inherit',
    stderr: 'inherit',
  }

  if (isBun) {
    const child = globalThis.Bun.spawn([process.execPath, 'server/index.mjs'], options)
    return () => child.kill()
  }

  const child = new globalThis.Deno.Command(globalThis.Deno.execPath(), {
    args: [
      'run',
      '--allow-net',
      '--allow-read',
      '--allow-write',
      '--allow-env',
      '--unstable-byonm',
      'server/index.mjs',
    ],
    ...options,
  }).spawn()
  return () => child.kill('SIGTERM')
}

async function waitForServer(baseUrl) {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`)
      if (response.ok)
        return
    }
    catch {}
    await sleep(200)
  }
  throw new Error(`playground server did not become ready at ${baseUrl}`)
}

async function getJson(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`)
  assert.equal(response.status, 200, `${path} responded ${response.status}`)
  return response.json()
}

async function main() {
  assert.ok(isBun || isDeno, 'this suite runs on Bun or Deno only')
  const runtime = isBun ? 'bun' : 'deno'
  const port = await freePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const stop = startServer(port)

  try {
    await waitForServer(baseUrl)

    const fetchCase = await getJson(baseUrl, '/api/outbound/fetch')
    assert.equal(fetchCase.ok, true)
    assert.equal(fetchCase.body.message, 'http upstream')
    assert.ok(fetchCase.elapsedMs >= 20, `fetch took ${fetchCase.elapsedMs}ms`)

    const httpCase = await getJson(baseUrl, '/api/outbound/http')
    assert.equal(httpCase.ok, true)
    assert.equal(httpCase.body.message, 'http upstream')
    assert.ok(httpCase.elapsedMs >= 20, `http took ${httpCase.elapsedMs}ms`)

    const http2Case = await getJson(baseUrl, '/api/outbound/http2')
    assert.equal(http2Case.ok, true)
    assert.equal(http2Case.body, 'http2 upstream')
    assert.ok(http2Case.elapsedMs >= 20, `http2 took ${http2Case.elapsedMs}ms`)

    const grpcCase = await getJson(baseUrl, '/api/outbound/grpc')
    assert.equal(grpcCase.ok, true)
    assert.deepEqual(grpcCase.response, { message: 'hello world' })
    assert.ok(grpcCase.elapsedMs >= 20, `grpc took ${grpcCase.elapsedMs}ms`)

    const callShape = await getJson(baseUrl, '/api/outbound/call-shape')
    assert.deepEqual(callShape.optionsFirst, { argCount: 2, isUrl: false, marker: true })
    assert.deepEqual(callShape.urlFirst, { argCount: 3, isUrl: true, marker: false })

    const html = await (await fetch(`${baseUrl}/outbound`)).text()
    assert.ok(html.includes('outbound cases'), 'the ssr page must render')
    assert.ok(html.includes('http2 upstream'), 'the ssr page must include the http2 case')
    assert.ok(html.includes('hello world'), 'the ssr page must include the grpc case')
    assert.ok(html.includes('argCount'), 'the ssr page must include the call shape case')

    const metrics = await (await fetch(`${baseUrl}/metrics`)).text()
    assert.match(metrics, /playground_page_request_time\{path="\/api\/outbound\/fetch",status_code="200"\} [1-9]\d*/)
    assert.match(metrics, /playground_page_request_time\{path="\/api\/outbound\/http",status_code="200"\} [1-9]\d*/)

    process.stdout.write(`playground e2e ok: ${runtime}\n`)
  }
  finally {
    stop()
  }
}

main().then(() => process.exit(0), (error) => {
  console.error(error)
  process.exit(1)
})
