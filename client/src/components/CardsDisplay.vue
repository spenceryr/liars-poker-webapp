<script setup>
import { defineProps, computed } from 'vue'
import PlayingCardIcon from '/@/components/PlayingCardIcon.vue'

/**
 * @property {{value: number, suit: string}} cards
 */
const props = defineProps({
  numCards: Number,
  cards: {
    /** @type import('vue').PropType<{value: number, suit: string}[]> */
    type: Array,
    required: false
  }
})

const sortedCards = computed(() => {
  return props.cards.sort((c1, c2) => c1.value - c2.value);
})

</script>

<template>
  <template v-if='cards'>
    <PlayingCardIcon v-for='card of sortedCards' :card='card'/>
  </template>
  <template v-else>
    <PlayingCardIcon :card='null'/> x {{ numCards }}
  </template>
</template>
