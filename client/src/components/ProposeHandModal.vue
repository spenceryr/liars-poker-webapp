<script setup>
import { computed, defineProps, shallowRef, ref, onMounted, onUnmounted, onBeforeUnmount } from 'vue';
import { PlayerCustomHand } from '/@/types/player-custom-hand.js'
import { Modal } from 'bootstrap';
import PlayingCardIcon from './PlayingCardIcon.vue';

/**
 * @typedef {{value: number, suit: undefined, id: string}} UniqueCard
 */
/**
 * @typedef {{value: number, suit: undefined}} Card
 */

const props = defineProps({
  lastHand: {
    /** @type {import('vue').PropType<Card[]>} */
    type: Array,
    required: true
  },
});
const emit = defineEmits(['proposed', 'close']);

function onHide(e) {
  emit('close');
}

onMounted(() => {
  modalObj = new Modal(modalRef.value);
  modalRef.value.addEventListener('hidden.bs.modal', onHide);
  modalObj.show();
});

onBeforeUnmount(() => {
  modalRef.value.removeEventListener('hidden.bs.modal', onHide);
})

onUnmounted(() => {
  modalObj.dispose();
  modalObj = null;
})

const modalRef = ref(null);
/** @type {import('bootstrap').Modal?} */
let modalObj = null;
const customLastHand = new PlayerCustomHand(props.lastHand.map((c) => c.value));
const proposedCustomHand = new PlayerCustomHand([]);
/** @type {Card[]} */
const allCards = [...Array(14).keys()].map((x) => Object({ value: x + 1 }) ).slice(1);
/** @type {import('vue').ShallowRef<UniqueCard[]>} */
const proposedHandUniqueCards = ref([]);
const isLargerThanLastHand = shallowRef(false);

let cardIDCounter = 0;
/**
 *
 * @param {number} value
 * @param {Object<string, number>} valueToCountMap
 * @returns {UniqueCard}
 */
function createUniqueCard(value, valueToCountMap) {
  let count = valueToCountMap[value]++ ?? 0;
  valueToCountMap[value] = count;
  return {
    value: value,
    id: value.toString() + count.toString(),
    suit: undefined
  };
}

/**
 *
 * @param {number} card
 */
function addCardToProposedHand(ev, card) {
  // TODO: (spencer) Maybe add shake animation if false.
  console.debug(`Maybe adding card ${card} to ${JSON.stringify(proposedCustomHand)}`);
  /** @type {Object<string, number>} */
  let valueToCountMap = {};
  if (proposedCustomHand.addCard(card)) {
    let valueToCountMap = {};
    proposedHandUniqueCards.value = proposedCustomHand.cards.map((c) => createUniqueCard(c, valueToCountMap)).sort((c1, c2) => c1.value - c2.value);
    isLargerThanLastHand.value = proposedCustomHand.compare(customLastHand) > 0;
  }
}

/**
 *
 * @param {number} card
 */
function removeCardFromProposedHand(ev, card) {
  console.debug(`Maybe removing card ${card} from ${JSON.stringify(proposedCustomHand)}`);
  if (proposedCustomHand.removeCard(card)) {
    let valueToCountMap = {};
    proposedHandUniqueCards.value = proposedCustomHand.cards.map((c) => createUniqueCard(c, valueToCountMap)).sort((c1, c2) => c1.value - c2.value);
    isLargerThanLastHand.value = proposedCustomHand.compare(customLastHand) > 0;
  }
}

function propose() {
  emit('proposed', proposedCustomHand.cards.map((card) => Object({ value: card })));
}

</script>

<template>
  <div ref="modalRef" class="modal fade" tabindex="-1">
    <div class="modal-dialog modal-fullscreen-md-down modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h1 class="modal-title fs-5">Propose Hand</h1>
          <button type="button" class="btn-close" aria-label="Close" @click="emit('close')"></button>
        </div>
        <div class="modal-body">
          <div class="container-fluid">
            <div class="row row-cols-auto align-items-center gy-5 gy-md-4 justify-content-center">
              <template v-if="proposedHandUniqueCards.length > 0">
                <div v-for="card of proposedHandUniqueCards" class="col" :key="card.id">
                  <button type="button" class="btn p-0" @click="(event) => removeCardFromProposedHand(event, card.value)">
                    <PlayingCardIcon width="46" height="64" :card="card" />
                  </button>
                </div>
              </template>
              <PlayingCardIcon :class="proposedHandUniqueCards.length > 0 ? 'd-none' : 'invisible'" width="46" height="64" :card="null" />
            </div>
            <hr/>
            <div class="row row-cols-auto row-cols-md-5 gy-5 gy-md-4 justify-content-center">
              <div v-for="card of allCards" class="col text-center">
                <button type="button" class="btn p-0" @click="(event) => addCardToProposedHand(event, card.value)">
                  <PlayingCardIcon width="46" height="64" :card="card" />
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="emit('close')">Close</button>
          <button type="button"
                  class="btn btn-primary"
                  :disabled="!isLargerThanLastHand"
                  @click='propose'
          >
            Propose
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
