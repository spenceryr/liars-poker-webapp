<script setup>
import { defineProps, computed } from 'vue'
import PlayingCardIcon from '/@/components/PlayingCardIcon.vue'

/**
 * @property {{value: number, suit: string}} cards
 */
defineProps({
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

const suits = ['c', 'd', 'h', 's'];

/**
 *
 * @param {{value: number, suit: string?}} card
 */
function convertCardToIconName(card) {
  if (card.value > 14 || card.value < 2) return 'unknown';
  const value = card.value < 10 ? card.value.toString() : faceNumToName[card.value];
  let suit = card.suit ?? suits[Math.random() * suits.length];
  return `${value ?? 0}${suit.toLowerCase()}`
}

</script>

<template>
  <span v-if='cards'>
    <PlayingCardIcon v-for='card in cards' :name='convertCardToIconName(card)'/>
  </span>
  <span v-else>
    <PlayingCardIcon :name='"unknown"'/> x {{ numCards }}
  </span>
</template>
