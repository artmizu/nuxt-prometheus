<script setup lang="ts">
import { useRuntimeConfig } from '#app'

const result = await $fetch<string>(useRuntimeConfig().upstream)
</script>

<template>
  <div>{{ result }}</div>
</template>
