import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { closeSync, mkdirSync, openSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const output = resolve(root, 'reports/memory')
const rounds = 4
const iterations = 4000
const limitBytes = 8 * 1024 * 1024
const samples = []
const started = Date.now()
rmSync(output, { recursive: true, force: true })
mkdirSync(output, { recursive: true })

const upstream = createServer((_req, res) => res.end('local upstream response'))
let server
let serverLog
let load
let verdict
let failure

async function stop(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null)
    return
  const exited = once(child, 'exit')
  child.kill('SIGTERM')
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000)
  try {
    await exited
  }
  finally {
    clearTimeout(timer)
  }
}

async function freePort() {
  const probe = createServer()
  probe.listen(0, '127.0.0.1')
  await once(probe, 'listening')
  const port = probe.address().port
  await new Promise((resolve, reject) => probe.close(error => error
    ? reject(error)
    : resolve()))
  return port
}

async function waitForServer(url) {
  const deadline = Date.now() + 60000
  while (Date.now() < deadline) {
    if (server.exitCode !== null || server.signalCode !== null)
      throw new Error('Fixture server exited before it became ready')
    try {
      const response = await fetch(`${url}/health`, {
        signal: AbortSignal.timeout(1000),
      })
      await response.text()
      if (response.ok)
        return
    }
    catch {}
    await delay(100)
  }
  throw new Error('Fixture server readiness timed out')
}

async function runLoad(label, count, baseURL) {
  const log = openSync(resolve(output, `${label}.log`), 'w')
  try {
    load = spawn('k6', [
      'run',
      '--quiet',
      '--summary-export',
      resolve(output, `${label}-k6.json`),
      'k6/memory.test.js',
    ], {
      cwd: root,
      env: {
        ...process.env,
        MEMORY_BASE_URL: baseURL,
        MEMORY_ITERATIONS: String(count),
        K6_NO_USAGE_REPORT: 'true',
      },
      stdio: ['ignore', log, log],
    })
    const [code, signal] = await once(load, 'exit')
    if (code !== 0)
      throw new Error(`k6 ${label} failed with ${signal || code}. See reports/memory/${label}.log`)
  }
  finally {
    closeSync(log)
  }
}

function command(message) {
  if (!server?.connected)
    return Promise.reject(new Error('Fixture server IPC is unavailable'))

  return new Promise((resolve, reject) => {
    let timer
    const onMessage = reply => finish(reply.error
      ? new Error(reply.error)
      : null, reply)
    const onExit = () => finish(new Error('Fixture server exited during memory collection'))
    const onError = error => finish(error)

    function finish(error, reply) {
      clearTimeout(timer)
      server.off('message', onMessage)
      server.off('exit', onExit)
      server.off('error', onError)
      if (error)
        reject(error)
      else
        resolve(reply)
    }
    timer = setTimeout(() => {
      if (server.connected)
        server.disconnect()
      finish(new Error('Fixture memory collection timed out; failure snapshot unavailable'))
    }, 60000)
    server.once('message', onMessage)
    server.once('exit', onExit)
    server.once('error', onError)
    server.send(message, error => error && finish(error))
  })
}

async function sample(label) {
  const { memory } = await command({ type: 'sample' })
  if (!Number.isFinite(memory?.heapUsed) || memory.heapUsed <= 0)
    throw new Error('Fixture returned an invalid heap measurement')
  samples.push({ label, ...memory })
  process.stdout.write(`${label}: post-GC heap ${(memory.heapUsed / 1024 / 1024).toFixed(2)} MiB\n`)
}

try {
  upstream.listen(0, '127.0.0.1')
  await once(upstream, 'listening')
  const port = await freePort()
  const baseURL = `http://127.0.0.1:${port}`
  serverLog = openSync(resolve(output, 'server.log'), 'w')
  server = spawn(process.execPath, ['--expose-gc', 'scripts/memory/server.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      NITRO_HOST: '127.0.0.1',
      NITRO_PORT: String(port),
      NUXT_UPSTREAM: `http://127.0.0.1:${upstream.address().port}`,
    },
    stdio: ['ignore', serverLog, serverLog, 'ipc'],
  })
  await waitForServer(baseURL)
  await runLoad('warmup', 1000, baseURL)
  const metrics = await (await fetch(`${baseURL}/metrics`)).text()
  for (const path of ['/', '/api/memory-node']) {
    const sum = metrics.match(new RegExp(`^page_request_time_histogram_sum\\{path="${path}",status_code="\\d+"\\} ([\\d.e+-]+)$`, 'm'))
    if (!sum || !(Number(sum[1]) > 0))
      throw new Error(`Outbound request timings are not active for ${path}`)
  }
  await sample('baseline')
  await command({
    type: 'snapshot',
    path: resolve(output, 'baseline.heapsnapshot'),
  })

  for (let round = 1; round <= rounds; round++) {
    await runLoad(`round-${round}`, iterations, baseURL)
    await sample(`round-${round}`)
  }

  const growthBytes = samples.at(-1).heapUsed - samples[0].heapUsed
  verdict = { passed: growthBytes <= limitBytes, growthBytes }
  if (!verdict.passed)
    throw new Error(`Retained heap grew by ${(verdict.growthBytes / 1024 / 1024).toFixed(2)} MiB; budget is 8 MiB`)

  process.stdout.write(`Memory regression check passed: ${(verdict.growthBytes / 1024 / 1024).toFixed(2)} MiB retained growth\n`)
}
catch (error) {
  failure = error
  if (server?.connected) {
    try {
      await command({
        type: 'snapshot',
        path: resolve(output, 'failure.heapsnapshot'),
      })
    }
    catch (snapshotError) {
      process.stderr.write(`Failure snapshot unavailable: ${snapshotError.message}\n`)
    }
  }
  process.stderr.write(`${error.stack}\n`)
  process.exitCode = 1
}
finally {
  writeFileSync(resolve(output, 'measurements.json'), JSON.stringify({
    node: process.version,
    rounds,
    iterations,
    limitBytes,
    elapsedMs: Date.now() - started,
    samples,
    verdict,
    failure: failure?.message,
  }, null, 2))
  await stop(load)
  await stop(server)
  if (serverLog !== undefined)
    closeSync(serverLog)
  upstream.closeAllConnections()
  await new Promise(resolve => upstream.close(resolve))
}
