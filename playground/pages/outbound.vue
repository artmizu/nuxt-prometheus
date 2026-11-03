<script setup lang="ts">
const cases = await Promise.all([
  $fetch('/api/outbound/fetch').then(data => ({ name: 'fetch', data })).catch(error => ({
    name: 'fetch',
    error: String(error),
  })),
  $fetch('/api/outbound/http').then(data => ({ name: 'http', data })).catch(error => ({
    name: 'http',
    error: String(error),
  })),
  $fetch('/api/outbound/http2').then(data => ({ name: 'http2', data })).catch(error => ({
    name: 'http2',
    error: String(error),
  })),
  $fetch('/api/outbound/grpc').then(data => ({ name: 'grpc', data })).catch(error => ({
    name: 'grpc',
    error: String(error),
  })),
  $fetch('/api/outbound/call-shape').then(data => ({ name: 'call-shape', data })).catch(error => ({
    name: 'call-shape',
    error: String(error),
  })),
])
</script>

<template>
  <div>
    <h1>outbound cases</h1>
    <pre id="outbound-cases">{{ cases }}</pre>
  </div>
</template>
