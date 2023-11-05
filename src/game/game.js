"use strict";
import assert from "node:assert";

import EventEmitter from "events";
import { StateMachine } from "./state-machine.js";
import { Player } from "./player.js";
import { PlayingCards } from "./playing-cards.js";
import { randomUUID } from "node:crypto";

export const GAME_EVENT = {
  GAME_START: "GAME_START",
  SETUP: "SETUP",
  PLAYER_TURN: "PLAYER_TURN",
  PLAYER_PROPOSE_HAND: "PLAYER_PROPOSE_HAND",
  REVEAL: "REVEAL",
  GAME_OVER: "GAME_OVER",
};

export class Game {
  static get MAX_PLAYERS() { return 6; }
  static get MIN_PLAYERS() { return 2; }

  /**
   *
   * @param {Player[]} players
   */
  constructor(players) {
    let numPlayers = players.length;
    assert(numPlayers <= Game.MAX_PLAYERS);
    /** @type {Player[]} */
    this.players = players;
    this.players.forEach((player) => player.numCards = Player.NUM_STARTING_CARDS);
    this.numCardsInPlay = numPlayers * Player.NUM_STARTING_CARDS;
    /** @type {PlayingCards?} */
    this.playingCards = null;
    this.currentPlayerTurnIndex = 0;
    /** @type {Player?} */
    this.callingPlayer = null;
    /** @type {Player?} */
    this.calledPlayer = null;
    /** @type {import("./player-custom-hand.js").PlayerCustomHand?} */
    this.lastHand = null;
    /** @type {Player?} */
    this.lastHandPlayer = null;
    /** @type {Player?} */
    this.lastRoundWinner = null;
    this.gameWinner = null;
    this.stateMachine = new GameStateMachine();
    this.stateMachine.emitter.on("state_change", this.handleStateChange.bind(this));
    this.emitter = new EventEmitter();
    this.gameID = randomUUID();
    console.debug(`Game ${this.gameID} created ${JSON.stringify(this)}`);
  }

  getGameSnapshot() {
    // TODO: (spencer) Create class.
    return {
      gameState: this.stateMachine.state,
      gameWinner: this.gameWinner?.playerID ?? null,
      currentPlayerTurn: this.players[this.currentPlayerTurnIndex].playerID,
      lastHand: this.lastHand?.cards.map((card) => card.toObj()) ?? null,
      lastHandPlayer: this.lastHandPlayer?.playerID ?? null,
      playersOrder: this.players.map((player) => player.playerID),
      playersNumCards: this.players.reduce((acc, curr) => Object.assign(acc, { [curr.playerID]: curr.numCards }), {}),
    }
  }

  handleStateChange(newState) {
    const GAME_STATES = GameStateMachine.GAME_STATES;
    switch (newState) {
      case GAME_STATES.NOT_STARTED: {
        break;
      }
      case GAME_STATES.SETUP: {
        console.debug(`Game ${this.gameID} transition to setup`);
        this.currentPlayerTurnIndex = this.getPlayerIndex(this.lastRoundWinner ?? 0) ?? 0;
        this.playingCards = new PlayingCards(this.numCardsInPlay);
        this.lastHand = null;
        this.lastHandPlayer = null;
        this.calledPlayer = null;
        this.callingPlayer = null;
        let numCardsPerPlayer = this.players.map((player) => player.numCards);
        let hands = this.playingCards.deal(numCardsPerPlayer);
        assert(hands);
        hands.forEach((cards, i) => this.players[i].cards = cards);
        this.emitter.emit(GAME_EVENT.SETUP, this.players);
        break;
      }
      case GAME_STATES.PLAYER_TURN: {
        console.debug(`Game ${this.gameID} player turn ${this.players[this.currentPlayerTurnIndex].playerID}`);
        this.emitter.emit(GAME_EVENT.PLAYER_TURN, this.players[this.currentPlayerTurnIndex]);
        break;
      }
      case GAME_STATES.PLAYER_TURN_END: {
        console.debug(`Game ${this.gameID} player turn end ${this.players[this.currentPlayerTurnIndex].playerID}`);
        let player = this.players[this.currentPlayerTurnIndex];
        this.currentPlayerTurnIndex = this.playerIndexOffset(1);
        this.emitter.emit(
          GAME_EVENT.PLAYER_PROPOSE_HAND,
          {
            "player": player,
            "proposedHand": this.lastHand,
          }
        );
        break;
      }
      case GAME_STATES.REVEAL: {
        console.debug(`Game ${this.gameID} reveal, caller: ${this.callingPlayer}, called: ${this.calledPlayer}`);
        const isItThere = this.playingCards.isItThere(this.lastHand.cards);
        let [winner, loser] = isItThere ? [this.calledPlayer, this.callingPlayer] : [this.callingPlayer, this.calledPlayer];
        loser.numCards -= 1;
        this.numCardsInPlay -= 1;
        this.lastRoundWinner = winner;
        this.emitter.emit(GAME_EVENT.REVEAL, { "loser": loser, "winner": winner });
        break;
      }
      case GAME_STATES.GAME_OVER: {
        let winner = null;
        for (const player of this.players) {
          if (!this.isPlayerPlaying(player)) continue;
          if (winner === null) winner = player;
          // Multiple players in play === No winner
          else {
            winner = null;
            break;
          }
        }
        this.gameWinner = winner;
        console.debug(`Game ${this.gameID} game over, winner: ${winner}`);
        this.emitter.emit(GAME_EVENT.GAME_OVER, winner)
        break;
      }
    }
  }

  // Helpers
  /**
   *
   * @param {number} offset
   * @returns
   */
  playerIndexOffset(offset) {
    if (offset === 0) return this.isPlayerPlaying(this.currentPlayerTurnIndex) ? this.currentPlayerTurnIndex : 0;
    for (let i = 0; i < this.players.length; i++) {
      let directionalIndex = offset > 0 ? i : (i * -1);
      // https://stackoverflow.com/questions/4467539/javascript-modulo-gives-a-negative-result-for-negative-numbers
      const index = (((this.currentPlayerTurnIndex + directionalIndex + offset) % this.players.length) + this.players.length) % this.players.length;
      if (this.isPlayerPlaying(this.players[index]))
        return index;
    }
  }

  /**
   *
   * @param {Player} player
   * @returns {number | null}
   */
  getPlayerIndex(player) {
    if (!this.isPlayerPlaying(player)) return null;
    return this.players.indexOf(player);
  }

  /**
   *
   * @param {Player} player
   * @returns
   */
  isPlayerPlaying(player) {
    return player.numCards > 0;
  }

  numPlayingPlayers() {
    return this.players.reduce((acc, curr) => this.isPlayerPlaying(curr) ? (acc + 1) : acc, 0);
  }

  // Game control flow methods
  start() {
    console.debug(`Game ${this.gameID} start`);
    this.emitter.emit(GAME_EVENT.GAME_START);
    return this.stateMachine.transition(GameStateMachine.GAME_STATES.SETUP);
  }

  /**
   *
   * @param {boolean} forceEnd
   * @returns
   */
  startNextRoundOrEndGame(forceEnd = false) {
    if (forceEnd || this.numPlayingPlayers() <= 1) {
      this.stateMachine.transition(GameStateMachine.GAME_STATES.GAME_OVER);
    }
    this.stateMachine.transition(GameStateMachine.GAME_STATES.SETUP);
  }

  playerStartTurn() {
    return this.stateMachine.transition(GameStateMachine.GAME_STATES.PLAYER_TURN);
  }

  // Player controlled calls.
  // TODO: (spencer) Maybe add a time window where this can't be called after a state transition to prevent
  //       last minute calls that end up on the wrong user.
  /**
   *
   * @param {Player} callingPlayer
   * @param {import("./player").PlayerID} calledPlayerID
   * @returns
   */
  playerCalled(callingPlayer, calledPlayerID) {
    console.debug(`Game ${this.gameID} player ${callingPlayer} called ${calledPlayerID}`);
    if (!this.stateMachine.verifyState(GameStateMachine.GAME_STATES.PLAYER_TURN)) return;
    if (!this.lastHand) return;
    let index = this.players.findIndex((player) => player.playerID === calledPlayerID);
    if(index !== this.playerIndexOffset(-1)) return;
    let calledPlayer = this.players[index];
    let callingPlayerIndex = this.getPlayerIndex(callingPlayer);
    if (callingPlayerIndex === null) return;
    if (callingPlayer === calledPlayer) return;
    this.callingPlayer = callingPlayer;
    this.calledPlayer = calledPlayer;
    this.stateMachine.transition(GameStateMachine.GAME_STATES.REVEAL);
  }
  /**
   *
   * @param {Player} player
   * @param {import("./player-custom-hand.js").PlayerCustomHand} hand
   * @returns
   */
  playerProposedHand(player, hand) {
    console.debug(`Game ${this.gameID} player ${player.playerID} proposed hand ${JSON.stringify(hand)}`);
    if (!this.stateMachine.verifyState(GameStateMachine.GAME_STATES.PLAYER_TURN)) return;
    let playerIndex = this.getPlayerIndex(player);
    if (playerIndex !== this.currentPlayerTurnIndex) return;
    if (hand.cards.length <= 0) return;
    if (this.lastHand && hand.compare(this.lastHand) <= 0) return;
    console.debug(`Game ${this.gameID} player hand was approved`);
    this.lastHand = hand;
    this.lastHandPlayer = player;
    this.stateMachine.transition(GameStateMachine.GAME_STATES.PLAYER_TURN_END);
  }
}

class GameStateMachine {
  constructor() {
    let states = {};
    for (const state in GameStateMachine.GAME_STATES) {
      if (!Object.prototype.hasOwnProperty.call(GameStateMachine.GAME_STATES, state)) return;
      let stateValue = GameStateMachine.GAME_STATES[state];
      states[stateValue] = {
        transitions: GameStateMachine.VALID_TRANSITIONS[stateValue],
      };
    }
    /** @type {StateMachine} */
    this.stateMachine = new StateMachine(states, GameStateMachine.GAME_STATES.NOT_STARTED);
    this.emitter = this.stateMachine.emitter;
  }

  static GAME_STATES = {
    NOT_STARTED: "NOT_STARTED",
    SETUP: "SETUP",
    PLAYER_TURN: "PLAYER_TURN",
    PLAYER_TURN_END: "PLAYER_TURN_END",
    REVEAL: "REVEAL",
    GAME_OVER: "GAME_OVER",
  };

  static VALID_TRANSITIONS = (() => {
    let t = {};
    const GAME_STATES = this.GAME_STATES;
    t[GAME_STATES.NOT_STARTED] = [GAME_STATES.SETUP];
    t[GAME_STATES.SETUP] = [GAME_STATES.PLAYER_TURN, GAME_STATES.GAME_OVER];
    t[GAME_STATES.PLAYER_TURN] = [GAME_STATES.REVEAL, GAME_STATES.PLAYER_TURN_END, GAME_STATES.GAME_OVER];
    t[GAME_STATES.PLAYER_TURN_END] = [GAME_STATES.PLAYER_TURN, GAME_STATES.GAME_OVER];
    t[GAME_STATES.REVEAL] = [GAME_STATES.SETUP, GAME_STATES.GAME_OVER];
    t[GAME_STATES.GAME_OVER] = [];
    return t;
  })();

  transition(nextState) {
    return this.stateMachine.transition(nextState);
  }

  verifyState(...states) {
    return this.stateMachine.verifyState(...states);
  }

  get state() { return this.stateMachine.state; }
}
