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

const faceNumToName = {
  11: 'j',
  12: 'q',
  13: 'k',
  14: 'a'
}

/**
 *
 * @param {{value: number, suit: string?}} card
 */
function convertCardToIconName(card) {
  if (typeof card.value !== 'number') return 'unknown';
  if (typeof card.suit !== 'string') return 'unknown';
  if (card.value > 14 || card.value < 2) return 'unknown';
  const value = card.value < 10 ? card.value.toString() : faceNumToName[card.value];
  let suit = card.suit ?? 'a';
  return `${value ?? 0}${suit.toLowerCase()}`
}

const sortedCards = computed(() => {
  return props.cards.sort((c1, c2) => c1.value - c2.value);
})

</script>

<template>
  <template v-if='cards'>
    <PlayingCardIcon v-for='card of sortedCards' class='px-2' :name='convertCardToIconName(card)'/>
  </template>
  <template v-else>
    <PlayingCardIcon :name='"unknown"'/> x {{ numCards }}
  </template>
</template>
