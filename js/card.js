export class Card {
  /**
   *
   * @param {number} value
   * @param {string} suit
   */
  constructor(value, suit) {
    this.value = value;
    this.suit = suit;
  }

  static get MAX_VALUE() { return 14; }
  static get MIN_VALUE() { return 2; }
}
