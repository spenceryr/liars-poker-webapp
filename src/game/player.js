"use strict";
import { randomUUID } from "crypto";

/**
 * @typedef {string} PlayerID
 */

export class Player {
  static get NUM_STARTING_CARDS() { return 5; }

  constructor(clientID) {
    this.numCards = Player.NUM_STARTING_CARDS;
    /** @type {import("./card.js").Card[]}*/
    this.cards = [];
    /** @type {string} */
    this.clientID = clientID;
    /** @type {PlayerID} */
    this.playerID = randomUUID();
    /** @type {boolean} */
    this.ready = false;
  }
}
