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
   * @param {number[]} cards
   */
  constructor(cards) {
    /** @type {number[]} */
    this.cards = [];
    this.cardsValueToCountMap = Array(CARD_MAX_VALUE + 1).fill(0);
    /** @type {CardsBitVector} */
    this.cardsBitVector = CardsBitVector();
    cards.forEach((c) => this.addCard(c));
  }

  static get MAX_HAND_SIZE() { return 5; }

  /**
   *
   * @param {number} card
   * @returns
   */
  addCard(card) {
    if (this.cards.length >= PlayerCustomHand.MAX_HAND_SIZE) return false;
    if (this.cardsValueToCountMap[card] >= MAX_SINGLE_VALUE_COUNT) return false;
    console.debug(`Adding card ${JSON.stringify(card)} to ${JSON.stringify(this)}`);
    this.cards.push(card);
    let oldCount = this.cardsValueToCountMap[card];
    let newCount = oldCount + 1;
    this.cardsValueToCountMap[card] = newCount;
    if (oldCount > 0) cardsBitVectorClear(this.cardsBitVector, card, oldCount);
    cardsBitVectorSet(this.cardsBitVector, card, newCount);
    return true;
  }

  /**
   *
   * @param {number} card
   * @returns
   */
  removeCard(card) {
    let index = this.cards.findIndex((c) => c === card);
    if (index === -1) return false;
    console.debug(`Removing card ${JSON.stringify(card)} from ${JSON.stringify(this)}`);
    this.cards.splice(index, 1);
    let oldCount = this.cardsValueToCountMap[card];
    let newCount = oldCount - 1;
    this.cardsValueToCountMap[card] = newCount;
    cardsBitVectorClear(this.cardsBitVector, card, oldCount);
    if (newCount > 0) cardsBitVectorSet(this.cardsBitVector, card, newCount);
    return true;
  }

  /**
   *
   * @param {PlayerCustomHand} against
   */
  compare(against) {
    console.debug(`Comparing this custom hand ${JSON.stringify(this)} vs ${JSON.stringify(against)}`);
    for (let i = CARDS_BITVECTOR_SIZE - 1; i >= 0; i--) {
      if (this.cardsBitVector[i] === against.cardsBitVector[i]) continue;
      return (this.cardsBitVector[i] > against.cardsBitVector[i]) ? 1 : -1;
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
