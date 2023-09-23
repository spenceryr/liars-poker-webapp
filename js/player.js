export class Player {
  static get NUM_STARTING_CARDS() { return 5; };

  constructor(id) {
    this.numCards = NUM_STARTING_CARDS;
    this.cards = undefined;
    this.id = id;
  }
}
