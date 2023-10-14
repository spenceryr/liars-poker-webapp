<script setup>
import { defineAsyncComponent, defineProps } from 'vue';

const props = defineProps({
  name: {
    type: String,
    required: true,
  },
});

const icon = defineAsyncComponent(() =>
  import(`../assets/playing-cards-icons/${props.name}.svg`)
);
</script>

<template>
  <component :is="icon" class="bi"/>
</template>
