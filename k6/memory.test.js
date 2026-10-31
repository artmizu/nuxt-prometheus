import { check } from 'k6'
import execution from 'k6/execution'
import http from 'k6/http'

const baseURL = __ENV.MEMORY_BASE_URL
const iterations = Number(__ENV.MEMORY_ITERATIONS || 4000)

if (!baseURL)
  throw new Error('MEMORY_BASE_URL is required')

export const options = {
  scenarios: {
    requests: {
      executor: 'shared-iterations',
      vus: 20,
      iterations,
      maxDuration: '30s',
      gracefulStop: '5s',
    },
  },
  thresholds: {
    'checks': ['rate==1'],
    'iterations': [`count==${iterations}`],
    'http_req_failed{kind:completed}': ['rate==0'],
  },
}

export default function () {
  const kind = execution.scenario.iterationInTest % 4
  if (kind === 3) {
    const response = http.get(`${baseURL}/api/memory-stream`, {
      timeout: '5ms',
      tags: { kind: 'aborted' },
    })
    check(response, { 'stream request timed out': result => result.error_code === 1050 })
    return
  }

  const path = ['/', '/api/memory-node', '/api/memory-stream'][kind]
  const response = http.get(`${baseURL}${path}`, {
    timeout: '5s',
    tags: { kind: 'completed' },
  })
  check(response, {
    'response status is 200': result => result.status === 200,
    'response body is complete': result => kind === 2
      ? result.body === 'start\nend\n'
      : result.body.includes('local upstream response'),
  })
}
