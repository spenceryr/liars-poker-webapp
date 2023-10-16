<script setup>
import { computed, defineProps, shallowRef, ref, onMounted, onUnmounted } from 'vue';
import CardsDisplay from '/@/components/CardsDisplay.vue';
import { PlayerCustomHand } from '/@/types/player-custom-hand.js'
import { Modal } from 'bootstrap';
import PlayingCardIcon from './PlayingCardIcon.vue';

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
const emit = defineEmits(['proposed', 'close']);

onMounted(() => {
  modalObj = new Modal(modalRef.value);
  modalObj.show();
});

onUnmounted(() => {
  modalObj.dispose();
  modalObj = null;
})

const modalRef = ref(null);
/** @type {import('bootstrap').Modal?} */
let modalObj = null;
const customLastHand = new PlayerCustomHand(props.lastHand);
const proposedCustomHand = new PlayerCustomHand([]);
const allCards = [...Array(14).keys()].map((x) => Object({ value: x + 1 }) ).slice(1);

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
  <div ref="modalRef" class="modal" tabindex="-1">
    <div class="modal-dialog modal-xl modal-fullscreen-md-down modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h1 class="modal-title fs-5">Propose Hand</h1>
          <button type="button" class="btn-close" aria-label="Close" @click="emit('close')"></button>
        </div>
        <div class="modal-body">
          <div class="container-fluid">
            <div class="row row-cols-auto align-items-center justify-content-center">
              <div v-for="card of sortedHand" class="col">
                <button @click="(event) => removeCardFromProposedHand(event, card)">
                  <PlayingCardIcon :card="card" />
                </button>
              </div>
            </div>
            <hr/>
            <div class="row row-cols-auto row-cols-md-5 gy-3 justify-content-center">
              <div v-for="card of allCards" class="col text-center">
                <button @click="(event) => addCardToProposedHand(event, card)">
                  <PlayingCardIcon :card="card" />
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="emit('close')">Close</button>
          <button type="button"
                  class="btn btn-primary"
                  :disabled="proposedCustomHand.compare(customLastHand) <= 0"
                  @click='propose'
          >
            Propose
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
