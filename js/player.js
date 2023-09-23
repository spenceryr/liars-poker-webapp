import { Card } from "./card";

export class Player {
  static get NUM_STARTING_CARDS() { return 5; };

  constructor(id) {
    this.numCards = NUM_STARTING_CARDS;
    /** @type {Card[]} */
    this.cards = [];
    this.id = id;
  }
}
