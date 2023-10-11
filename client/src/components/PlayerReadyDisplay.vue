<script setup>
import { defineProps } from 'vue';

defineProps({
  ready: Boolean
})
</script>

<template>
  <i v-if="ready" class="bi bi-check-circle-fill text-success"></i>
  <i v-else class="bi bi-question-lg text-secondary"></i>
</template>
