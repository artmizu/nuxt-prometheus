import assert from 'node:assert/strict'
import http from 'node:http'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createOutboundCollector, detectRuntime } from '../../dist/runtime/collector/index.js'

const delay = 40

function listen(server) {
  return new Promise((resolve, reject) => {
    server.on('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
}

function get(port, path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${path}`, (response) => {
      response.resume()
      response.on('end', resolve)
    }).on('error', reject)
  })
}

function spawnChild(script) {
  if (typeof globalThis.Bun !== 'undefined')
    return globalThis.Bun.spawn([process.execPath, script], { stdout: 'ignore', stderr: 'ignore' }).exited

  const child = new globalThis.Deno.Command(globalThis.Deno.execPath(), {
    args: ['run', '-A', script],
    stdout: 'null',
    stderr: 'null',
  }).spawn()
  return child.status.then(status => status.code)
}

async function main() {
  const runtime = detectRuntime()
  assert.ok(runtime === 'bun' || runtime === 'deno', `expected bun or deno, received ${runtime}`)

  const upstream = http.createServer((request, response) => {
    setTimeout(() => response.end('ok'), delay)
  })
  await listen(upstream)
  const port = upstream.address().port

  const seen = []
  const originalRequest = http.request
  http.request = function recordingRequest(...args) {
    seen.push(args)
    return originalRequest.apply(this, args)
  }

  const state = { requests: {} }
  const urls = []
  const collector = createOutboundCollector({
    getState: () => state,
    onRequest: (url) => {
      urls.push(url)
    },
  })
  const originalFetch = globalThis.fetch
  collector.start()
  assert.notEqual(globalThis.fetch, originalFetch, 'the collector must wrap fetch on this runtime')

  await new Promise((resolve, reject) => {
    const request = http.request({
      host: '127.0.0.1',
      port,
      path: '/options-first',
      headers: { 'x-test': '1' },
      disableAppInsightsAutoCollection: true,
    }, (response) => {
      response.resume()
      response.on('end', resolve)
    })
    request.on('error', reject)
    request.end()
  })

  assert.equal(seen.length, 1, 'the downstream http.request patch must be called once')
  assert.equal(seen[0].length, 2, 'the downstream patch must receive the caller argument shape')
  assert.ok(!(seen[0][0] instanceof URL), 'the downstream patch must not receive a normalized URL')
  assert.equal(seen[0][0].disableAppInsightsAutoCollection, true, 'the opt-out marker must reach the downstream patch')

  await fetch(`http://127.0.0.1:${port}/fetch`)
  await get(port, '/http')
  await fetch(`http://127.0.0.1:${port}/__nuxt_island/component`)

  const timings = Object.values(state.requests)
  assert.equal(timings.length, 3, `expected 3 recorded requests, received ${timings.length}`)
  for (const timing of timings)
    assert.ok(timing.end - timing.start >= delay - 10, `expected a measured request, received ${timing.end - timing.start}ms`)
  assert.ok(urls.includes(`http://127.0.0.1:${port}/fetch`), `the fetch url must include the port, received ${urls.join(', ')}`)
  assert.ok(urls.includes(`http://127.0.0.1:${port}/http`), `the http url must include the port, received ${urls.join(', ')}`)

  collector.stop()
  assert.equal(globalThis.fetch, originalFetch, 'the collector must restore fetch on stop')
  http.request = originalRequest

  const stateless = createOutboundCollector({
    getState: () => undefined,
  })
  stateless.start()
  await fetch(`http://127.0.0.1:${port}/background`)
  stateless.stop()

  const errorScript = fileURLToPath(new URL('./collector-error.runtime.mjs', import.meta.url))
  const errorExitCode = await spawnChild(errorScript)
  assert.notEqual(errorExitCode, 0, 'an unhandled request error must surface on this runtime')

  upstream.closeAllConnections?.()
  await new Promise(resolve => upstream.close(resolve))

  process.stdout.write(`collector runtime ok: ${runtime}\n`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
