import http from 'k6/http'
import { check, sleep } from 'k6'
import globalOptions from './options.js'

export const options = globalOptions

export default function () {
  const res = http.get('http://10.18.168.237:3000/c')
  check(res, {
    'is status 200': r => r.status === 200,
    'is contain elements': r => r.html('#response'),
  })
  sleep(1)
}
