import { Card }  from "./card";

export class PlayingCards {
  constructor(numCards) {
    this.cardsInPlay = [];
    let deckCopy = [...PlayingCards.FULL_DECK];
    for (let i = 0; i < numCards; i++) {
      let index = Math.floor(Math.random() * (PlayingCards.FULL_DECK.length - i));
      this.cardsInPlay.push(deckCopy[index]);
      deckCopy.splice(index, 1);
    }
  }

  /**
   *
   * @param {number[]} numCardsPerPlayer
   * @returns
   */
  deal(numCardsPerPlayer) {
    if (numCardsPerPlayer.reduce((acc, curr) => acc + curr, 0) != numCards) {
      return undefined;
    }
    let allPlayerCards = [];
    let numCardsInPlay = this.cardsInPlay.length;
    let cardsInPlayCopy = [...this.cardsInPlay];
    for (let numCards in numCardsPerPlayer) {
      let playerCards = [];
      for (let i = 0; i < numCards; i++) {
        let index = Math.floor(Math.random() * (numCardsInPlay - i));
        playerCards.push(cardsInPlayCopy[index]);
        cardsInPlayCopy.splice(index, 1);
      }
      allPlayerCards.push(playerCards);
    }
    return allPlayerCards;
  }

  /**
   * TODO: (spencer) This is technically O(n*m) but it's not bad because we know it's max O(30*5)
   * @param {Card[]} cards
   * @returns {boolean}
   */
  isItThere(cards) {
    let cardsCopy = [...cards];
    this.cardsInPlay.forEach((card) => {
      if (cardsCopy.length === 0) return;
      let index = cards.findIndex((card2) => card.value === card2.value)
      if (index !== -1) cardsCopy.splice(index, 1);
    });
    return cardsCopy.length === 0;
  }

  /**
   * @type {Card[]}
   */
  static FULL_DECK = (() => {
    var values = Array.from({ length: Card.MAX_VALUE - Card.MIN_VALUE + 1 }, (_, i) => i + Card.MIN_VALUE);
    var suits = ["D", "C", "S", "H"];
    return values.flatMap((v) => suits.map((s) => { return new Card(v, s); }));
  })();
}
