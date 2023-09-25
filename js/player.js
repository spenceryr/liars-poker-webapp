import { randomUUID } from "crypto";
import { Card } from "./card";

/**
 * @typedef {string} PlayerID
 */

export class Player {
  static get NUM_STARTING_CARDS() { return 5; };

  constructor(clientID) {
    this.numCards = NUM_STARTING_CARDS;
    /** @type {Card[]} */
    this.cards = [];
    /** @type {string} */
    this.clientID = clientID;
    /** @type {PlayerID} */
    this.playerID = randomUUID();
    /** @type {boolean} */
    this.ready = false;
  }
}
