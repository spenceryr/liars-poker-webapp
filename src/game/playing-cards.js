"use strict";
import { Card }  from "./card.js";

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
    if (numCardsPerPlayer.reduce((acc, curr) => acc + curr, 0) !== this.cardsInPlay.length) {
      return undefined;
    }
    let numCardsInPlay = this.cardsInPlay.length;
    let cardsInPlayCopy = [...this.cardsInPlay];
    return numCardsPerPlayer.map((numCards) => {
      let playerCards = [];
      for (let i = 0; i < numCards; i++) {
        let index = Math.floor(Math.random() * numCardsInPlay);
        playerCards.push(cardsInPlayCopy[index]);
        cardsInPlayCopy.splice(index, 1);
        numCardsInPlay -= 1;
      }
      return playerCards;
    });
  }

  /**
   * TODO: (spencer) This is technically O(n*m) but it's not bad because we know it's max O(30*5)
   * @param {Card[]} cards
   * @returns {boolean}
   */
  isItThere(cards) {
    let cardsCopy = [...cards];
    for (const card of this.cardsInPlay) {
      if (cardsCopy.length === 0) return true;
      let index = cardsCopy.findIndex((card2) => card.value === card2.value)
      if (index !== -1) cardsCopy.splice(index, 1);
    }
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
