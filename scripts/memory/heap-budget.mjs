export function assessHeap(samples, limitBytes) {
  if (samples.length < 2)
    throw new Error('At least two heap samples are required')
  if (!Number.isFinite(limitBytes) || limitBytes <= 0)
    throw new Error('Heap growth limit must be a positive number')
  if (samples.some(sample => !Number.isFinite(sample.heapUsed) || sample.heapUsed <= 0))
    throw new Error('Heap samples must contain positive heapUsed values')

  const growthBytes = samples.at(-1).heapUsed - samples[0].heapUsed
  return { passed: growthBytes <= limitBytes, growthBytes, limitBytes }
}
