import { StateMachine } from "./state-machine";
import { Player } from "./player";
import EventEmitter from "events";
import { PlayingCards } from "./playing-cards";
import { PlayerCustomHand } from "./player-custom-hand";
import { Card } from "./card";

let gameEventID = 0;

export const GAME_EVENT = {
  SETUP: gameEventID++,
  PLAYER_TURN: gameEventID++,
  PLAYER_PROPOSE_HAND: gameEventID++,
  REVEAL: gameEventID++,
  GAME_OVER: gameEventID++,
};

export class Game {
  static get MAX_PLAYERS() { return 6; }
  static get MIN_PLAYERS() { return 2; }

  /**
   *
   * @param {Player[]} players
   * @param {Player} startingPlayer
   */
  constructor(players, startingPlayer) {
    let numPlayers = players.length;
    assert(numPlayers <= PLAYERS_MAX);
    let startingPlayerIndex = players.indexOf(startingPlayer);
    assert(startingPlayerIndex >= 0);
    /** @type {Player[]} */
    this.players = players;
    this.numCardsInPlay = numPlayers * Player.NUM_STARTING_CARDS;
    /** @type {PlayingCards} */
    this.playingCards = null;
    this.currentPlayerIndexTurn = startingPlayerIndex;
    /** @type {Player} */
    this.callingPlayer = null;
    /** @type {Player} */
    this.calledPlayer = null;
    /** @type {PlayerCustomHand} */
    this.lastHand = null;
    this.stateMachine = new GameStateMachine();
    this.stateMachine.emitter.on("state_change", this.handleStateChange);
    this.emitter = new EventEmitter();
  }

  handleStateChange(newState) {
    const GAME_STATES = GameStateMachine.GAME_STATES;
    switch (newState) {
      case GAME_STATES.NOT_STARTED: {
        break;
      }
      case GAME_STATES.SETUP: {
        this.playingCards = new PlayingCards(this.numCardsInPlay);
        let numCardsPerPlayer = this.players.map((player) => player.numCards);
        let hands = this.playingCards.deal(numCardsPerPlayer);
        hands.forEach((cards, i) => this.players[i].cards = cards);
        this.emitter.emit(GAME_EVENT.SETUP, this.players);
        break;
      }
      case GAME_STATES.PLAYER_TURN: {
        this.emitter.emit(GAME_EVENT.PLAYER_TURN, this.players[this.currentPlayerIndexTurn]);
        break;
      }
      case GAME_STATES.PLAYER_TURN_END: {
        let player = this.players[this.currentPlayerIndexTurn];
        this.currentPlayerIndexTurn = this.playerIndexOffset(1);
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
        const isItThere = this.playingCards.isItThere(this.lastHand.cards);
        let [winner, loser] = isItThere ? [this.calledPlayer, this.callingPlayer] : [this.callingPlayer, this.calledPlayer];
        loser.numCards -= 1;
        this.numCardsInPlay -= 1;
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
        this.emitter.emit(GAME_EVENT.GAME_OVER.id, winner)
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
    for (let i = 0; i < this.players.length; i++) {
      const index = (this.currentPlayerIndexTurn + i + offset) % this.players.length;
      if (this.isPlayerPlaying(this.players[index]))
        return index;
    }
  }

  /**
   *
   * @param {Player} player
   * @returns
   */
  getPlayerIndex(player) {
    if (!this.isPlayerPlaying(player)) return -1;
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
    return this.players.reduce((acc, curr) => this.isPlayerPlaying(curr) ? acc : (acc + 1), 0);
  }

  // Game control flow methods
  start() {
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
   * @param {Player} calledPlayer
   * @returns
   */
  playerCalled(callingPlayer, calledPlayer) {
    if (!this.stateMachine.verifyState(GameStateMachine.GAME_STATES.PLAYER_TURN)) return;
    if(calledPlayer !== this.players[this.playerIndexOffset(-1)]) return;
    let callingPlayerIndex = this.getPlayerIndex(callingPlayer);
    if (callingPlayerIndex < 0) return;
    if (callingPlayer === calledPlayer) return;
    this.callingPlayer = callingPlayer;
    this.calledPlayer = calledPlayer;
    this.stateMachine.transition(GameStateMachine.GAME_STATES.REVEAL);
  }
  /**
   *
   * @param {Player} player
   * @param {PlayerCustomHand} hand
   * @returns
   */
  playerProposedHand(player, hand) {
    if (!this.stateMachine.verifyState(GameStateMachine.GAME_STATES.PLAYER_TURN)) return;
    let playerIndex = this.getPlayerIndex(player);
    if (playerIndex !== this.currentPlayerIndexTurn) return;
    if (this.lastHand && hand.compare(this.lastHand) <= 0) return;
    this.lastHand = hand;
    this.stateMachine.transition(GameStateMachine.GAME_STATES.PLAYER_TURN_END);
  }
}

class GameStateMachine {
  constructor() {
    let states = {};
    for (const state in GAME_STATES) {
      if (!GameStateMachine.GAME_STATES.hasOwnProperty(state)) return;
      states[state] = {
        transitions: GameStateMachine.VALID_TRANSITIONS[state],
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
    this.stateMachine.verifyState(...states);
  }
}
