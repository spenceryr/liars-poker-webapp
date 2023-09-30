"use strict";
export class Card {
  /**
   *
   * @param {number} value
   * @param {string?} suit
   */
  constructor(value, suit = null) {
    this.value = value;
    this.suit = suit;
  }

  toObj() {
    return { value: this.value, suit: this.suit };
  }

  static get MAX_VALUE() { return 14; }
  static get MIN_VALUE() { return 2; }
}
