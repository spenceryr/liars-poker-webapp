<script setup>
import { defineProps } from 'vue';

defineProps({
  conn: String
})
</script>

<template>
  <i v-if='conn === "disconnected"' class="bi bi-wifi-off"></i>
  <span v-else-if='conn === "connected"'></span>
  <span v-else-if='conn === "connecting"' class="spinner-border spinner-border-sm"></span>
</template>
