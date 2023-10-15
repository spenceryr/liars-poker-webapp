<script setup>
import { defineProps, defineEmits, shallowRef } from 'vue';

const props = defineProps({
  remoteReady: {
    type: Boolean,
    required: true
  }
});

const emit = defineEmits(['set-ready']);

const localReady = shallowRef(props.remoteReady)

function toggleReady() {
  localReady.value = !localReady.value;
  emit('set-ready', localReady.value);
}

</script>

<template>
  <button class="btn"
      :class="localReady ? 'btn-danger' : 'btn-success'"
      @click="toggleReady"
    >
      {{ localReady ? "Unready" : "Ready" }}
  </button>
</template>
