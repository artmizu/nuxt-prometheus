import { check, sleep } from 'k6'
import http from 'k6/http'
import globalOptions from './options.js'

export const options = globalOptions

export default function () {
  const res = http.get('http://192.168.0.220:3000/memory-measure')
  check(res, {
    'is status 200': r => r.status === 200,
    'is contain elements': r => r.html('#response'),
  })
  sleep(1)
}
