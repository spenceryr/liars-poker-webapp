<script setup>
import { defineProps, computed } from 'vue'
import PlayingCardIcon from '/@/components/PlayingCardIcon.vue'

/**
 * @typedef {{value: number, suit: string | undefined, id: number}} UniqueCard
 */
/**
 * @typedef {{value: number, suit: string | undefined}} Card
 */

const props = defineProps({
  numCards: Number,
  cards: {
    /** @type import('vue').PropType<Card[]> */
    type: Array,
    required: false
  }
});

let cardIDCounter = 0;
/**
 *
 * @param {Card} card
 * @returns {UniqueCard}
 */
function createUniqueCard(card) {
  return {
    value: card.value,
    id: cardIDCounter++,
    suit: card.suit
  };
}

const sortedUniqueCards = computed(() => {
  return props.cards.map((card) => createUniqueCard(card)).sort((c1, c2) => c1.value - c2.value);
});

</script>

<template>
  <template v-if='cards'>
    <PlayingCardIcon class="m-1" width="34.5" height="48" v-for='card of sortedUniqueCards' :card='card' :key="card.id"/>
  </template>
  <template v-else>
    <PlayingCardIcon width="34.5" height="48" :card='null'/> x {{ numCards }}
  </template>
</template>
