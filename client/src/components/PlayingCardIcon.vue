<script setup>
import { defineAsyncComponent, defineProps } from 'vue';

const props = defineProps({
  card: {
    /** @type import('vue').PropType<{value: number, suit: string}> */
    type: Object,
    required: true,
  },
});



const faceNumToName = {
  11: 'j',
  12: 'q',
  13: 'k',
  14: 'a'
}

/**
 *
 * @param {{value: number, suit: string?}?} card
 */
function convertCardToIconName(card) {
  if (!card || typeof card.value !== 'number') return 'unknown';
  if (card.value > 14 || card.value < 2) return 'unknown';
  const value = card.value <= 10 ? card.value.toString() : faceNumToName[card.value];
  let suit = card.suit ?? 'a';
  if (typeof suit !== 'string') return 'unknown';
  return `${value ?? 0}${suit.toLowerCase()}`
}

const icon = defineAsyncComponent(() =>
  import(`@/assets/playing-card-icons/${convertCardToIconName(props.card)}.svg`)
);
</script>

<template>
  <component :is="icon"/>
</template>
