<script setup>
import { defineProps } from 'vue';

defineProps({
  conn: String
})
</script>

<template>
  <i v-if='conn === "DISCONNECTED"' class="bi bi-wifi-off"></i>
  <span v-else-if='conn === "CONNECTED"'></span>
  <span v-else-if='conn === "CONNECTING"' class="spinner-border spinner-border-sm"></span>
</template>
