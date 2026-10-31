import type { NuxtPrometheusState } from './type'

export function calculateTime(data: NuxtPrometheusState) {
  const list = Object.values(data.requests)
    .sort((first, second) => first.start - second.start)
    .reduce<{ start: number, end: number }[]>((reducer, current) => {
      const last = reducer[reducer.length - 1]
      if (!last)
        reducer.push(current)
      else if (last.end >= current.start && current.end > last.end)
        last.end = current.end
      else if (current.start > last.end)
        reducer.push(current)

      return reducer
    }, [])

  const time = {
    request: 0,
    render: 0,
    total: Date.now() - data.start,
  }

  list.forEach((el) => {
    time.request += el.end - el.start
  })

  time.render = time.total - time.request
  return time
}
