<script setup lang="ts">
import { useFetch } from '#app'

// Server-side http2 over TLS request (the transport gRPC uses), see server/api/grpc
const { data } = await useFetch('/api/grpc')
</script>

<template>
  <div>
    grpc
    <pre id="response">{{ data }}</pre>
  </div>
</template>
