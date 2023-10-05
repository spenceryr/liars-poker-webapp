"use strict";
import { Card } from "./card.js";

export class PlayerCustomHandItem {
  /**
   *
   * @param {number} value
   * @param {number} count
   */
  constructor(value, count) {
    if (value > Card.MAX_VALUE) value = Card.MAX_VALUE;
    else if (value < Card.MIN_VALUE) value = Card.MIN_VALUE;
    if (count > PlayerCustomHandItem.MAX_COUNT) count = PlayerCustomHandItem.MAX_COUNT;
    else if (count <= PlayerCustomHandItem.MIN_COUNT) count = PlayerCustomHandItem.MIN_COUNT;
    this.value = value;
    this.count = count;
  }

  static get MAX_COUNT() { return 4; }
  static get MIN_COUNT() { return 1; }
}


/** @typedef {Uint16Array} CardsBitVector */

/** @type {number} */
const CARDS_BITVECTOR_SIZE = Math.ceil((Card.MAX_VALUE - Card.MIN_VALUE + 1) * PlayerCustomHandItem.MAX_COUNT / 16);

/**
 *
 * @returns {CardsBitVector}
 */
function CardsBitVector() { return new Uint16Array(CARDS_BITVECTOR_SIZE); }

// TODO: (spencer) Most of this probably is client side only. Just need the compare function here.
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
    let cardsMap = cards.reduce((acc, curr) => {
      let currValue = acc[curr];
      if (currValue === undefined) acc[curr] = 1;
      else acc[curr] = currValue + curr.value;
      return acc;
    }, new Map());
    cardsMap.forEach((count, value) => this.addItem(new PlayerCustomHandItem(value, count)));
  }

  static get MAX_COUNT() { return 5; }

  /**
   *
   * @param {PlayerCustomHandItem} item
   * @returns
   */
  addItem(item) {
    if (this.cards.length > PlayerCustomHand.MAX_COUNT - item.count) return false;
    if (this.cardsValueToCountMap[item.value] + item.count > PlayerCustomHandItem.MAX_COUNT) return false;
    for (let i = 0; i < item.count; i++)
      this.cards.push(new Card(item.value));
    let oldCount = this.cardsValueToCountMap[item.value];
    let newCount = oldCount + item.count;
    this.cardsValueToCountMap[item.value] = newCount;
    if (oldCount > 0) cardsBitVectorClear(this.cardsBitVector, item.value, oldCount);
    cardsBitVectorSet(this.cardsBitVector, item.value, newCount);
    return true;
  }

  /**
   *
   * @param {PlayerCustomHandItem} item
   * @returns
   */
  removeItem(item) {
    let index = this.cards.findIndex((card) => card.value === item.value);
    if (index === -1) return false;
    if (item.count > this.cardsValueToCountMap[item.value]) return false;
    delete this.cards[index];
    let oldCount = this.cardsValueToCountMap[item.value];
    let newCount = oldCount - item.count;
    this.cardsValueToCountMap[item.value] = newCount;
    cardsBitVectorClear(this.cardsBitVector, item.value, oldCount);
    if (newCount > 0) cardsBitVectorSet(this.cardsBitVector, item.value, newCount);
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
