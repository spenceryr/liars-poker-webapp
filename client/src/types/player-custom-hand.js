/**
 * @typedef {{value: number, suit: string}} Card
 */

/**
 * @typedef {Uint16Array} CardsBitVector
 */

const CARD_MAX_VALUE = 14;
const CARD_MIN_VALUE = 2;
const MAX_SINGLE_VALUE_COUNT = 4;
const CARDS_BITVECTOR_SIZE = Math.ceil((CARD_MAX_VALUE - CARD_MIN_VALUE + 1) * MAX_SINGLE_VALUE_COUNT / 16);

/**
 *
 * @returns {CardsBitVector}
 */
function CardsBitVector() { return new Uint16Array(CARDS_BITVECTOR_SIZE); }

export class PlayerCustomHand {
  /**
   *
   * @param {Card[]} cards
   */
  constructor(cards) {
    /** @type {Card[]} */
    this.cards = [];
    this.cardsValueToCountMap = Array(14).fill(0);
    /** @type {CardsBitVector} */
    this.cardsBitVector = CardsBitVector();
    cards.forEach((c) => this.addCard(c));
  }

  static get MAX_HAND_SIZE() { return 5; }

  /**
   *
   * @param {Card} card
   * @returns
   */
  addCard(card) {
    if (this.cards.length >= PlayerCustomHand.MAX_HAND_SIZE) return false;
    if (this.cardsValueToCountMap[card.value] >= MAX_SINGLE_VALUE_COUNT) return false;
    this.cards.push(card);
    let oldCount = this.cardsValueToCountMap[card.value];
    let newCount = oldCount + 1;
    this.cardsValueToCountMap[card.value] = newCount;
    if (oldCount > 0) cardsBitVectorClear(this.cardsBitVector, card.value, oldCount);
    cardsBitVectorSet(this.cardsBitVector, card.value, newCount);
    return true;
  }

  /**
   *
   * @param {Card} card
   * @returns
   */
  removeCard(card) {
    let index = this.cards.findIndex((c) => c.value === card.value);
    if (index === -1) return false;
    this.cards.splice(index, 1);
    let oldCount = this.cardsValueToCountMap[card.value];
    let newCount = oldCount - 1;
    this.cardsValueToCountMap[card.value] = newCount;
    cardsBitVectorClear(this.cardsBitVector, card.value, oldCount);
    if (newCount > 0) cardsBitVectorSet(this.cardsBitVector, card.value, newCount);
  }

  /**
   *
   * @param {PlayerCustomHand} against
   */
  compare(against) {
    for (let i = CARDS_BITVECTOR_SIZE; i >= 0; i--) {
      if (this.cardsBitVector[i] === against.cardsBitVector[i]) continue;
      return this.cardsBitVector[i] > this.cardsBitVector[i] ? 1 : -1;
    }
    return 0;
  }
}

/**
 *
 * @param {CardsBitVector} bv
 * @param {number} value
 * @param {number} count
 */
function cardsBitVectorClear(bv, value, count) {
  bv[count - 1] &= ~(1 << value);
}

function cardsBitVectorSet(bv, value, count) {
  bv[count - 1] |= 1 << value;
}
