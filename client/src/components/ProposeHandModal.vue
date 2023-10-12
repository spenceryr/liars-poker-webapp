<script setup>
import { computed, defineProps, shallowRef } from 'vue';
import CardsDisplay from '/@/components/CardsDisplay.vue';
import { PlayerCustomHand } from '/@/types/player-custom-hand.js'

/**
 * @typedef {{value: number, suit: string}} Card
 */

const props = defineProps({
  lastHand: {
    /** @type {import('vue').PropType<Card[]>} */
    type: Array,
    required: true
  },
});
const emit = defineEmits(['proposed']);

const customLastHand = new PlayerCustomHand(props.lastHand);
const proposedCustomHand = new PlayerCustomHand([]);
const allCards = [...Array(14).keys()].map((x) => Object({ value: x + 1 }) );

/** @type {import('vue').ShallowRef<Card[]>} */
const proposedHandCards = shallowRef([]);
/** @type {import('vue').ComputedRef<Card[]>} */
const sortedHand = computed(() => {
  return proposedHandCards.value.sort((c1, c2) => c1.value - c2.value);
});

/**
 *
 * @param {Card} card
 */
function addCardToProposedHand(ev, card) {
  // TODO: (spencer) Maybe add shake animation if false.
  if (proposedCustomHand.addCard(card)) {
    proposedHandCards.value = proposedCustomHand.cards;
  }
}

/**
 *
 * @param {Card} card
 */
function removeCardFromProposedHand(ev, card) {
  if (proposedCustomHand.removeCard(card)) {
    proposedHandCards.value = proposedCustomHand.cards;
  }
}

function propose() {
  emit('proposed', proposedHandCards.value)
}

</script>

<template>
  <div class="modal-dialog modal-xl modal-fullscreen-md-down modal-dialog-centered">
    <div class="modal-content">
      <div class="modal-header">
        <h1 class="modal-title fs-5">Propose Hand</h1>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <div class="container-fluid">
          <div class="row align-items-center justify-content-center">
            <div v-for="card of sortedHand" class="col">
              <button @click="(event) => removeCardFromProposedHand(event, card)">
                <CardsDisplay :cards="[card]" ></CardsDisplay>
              </button>
            </div>
          </div>
          <hr/>
          <div class="row">
            <div v-for="card of allCards" class="col-3 col-md-2 py-3">
              <button @click="(event) => addCardToProposedHand(event, card)">
                <CardsDisplay :cards="[card]" ></CardsDisplay>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
        <button type="button"
                class="btn btn-primary"
                data-bs-dismiss="modal"
                :disabled="proposedCustomHand.compare(customLastHand) <= 0"
                @click='propose'
        >
          Propose
        </button>
      </div>
    </div>
  </div>
</template>
