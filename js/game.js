import { StateMachine } from "./state-machine";
import { Player } from "./player";
import EventEmitter from "events";
import { PlayingCards } from "./playing-cards";
import { PlayerCustomHand } from "./player-custom-hand";
import { Card } from "./card";

let gameEventID = 0;

/**
 *
 * @param {Player[]} players
 */
function PlayerHandsObj(players) {
  return players.reduce((acc, curr) => Object.assign(
    acc,
    { [curr.id]: curr.cards.map((card) => Object({...card})) }
  ), {});
}

/**
 *
 * @param {PlayerCustomHand} proposedHand
 * @returns
 */
function PlayerProposedHandObj(proposedHand) {
  return proposedHand.items.reduce((acc, curr) => Object.assign(acc, { [curr.value]: curr.count }), {});
}

export const GAME_EVENT = {
  SETUP: {
    id: gameEventID++,
    obj: (playerHands) => Object({ playerHands: playerHands })
  },
  PLAYER_TURN: {
    id: gameEventID++,
    obj: (playerID) => Object({ playerID: playerID })
  },
  PLAYER_PROPOSE_HAND: {
    id: gameEventID++,
    obj: (playerID, hand) => Object({ playerID: playerID, hand: hand })
  },
  REVEAL: {
    id: gameEventID++,
    obj: (playerHands, losingPlayerID, winningPlayerID) => Object({
      playerHands: playerHands,
      losingPlayerID: losingPlayerID,
      winningPlayerID: winningPlayerID,
    })
  },
  GAME_OVER: {
    id: gameEventID++,
    obj: (winnerID) => Object({ winnerID: winnerID })
  },
};

export class Game {
  static get PLAYERS_MAX() { return 6; }

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
    this.stateMachine = new GameStateMachine(this);
    this.stateMachine.emitter.on("state_change", this.handleStateChange);
    this.emitter = new EventEmitter();
  }

  handleStateChange(newState) {
    const GAME_STATES = GameStateMachine.GAME_STATES;
    switch (newState) {
      case GAME_STATES.NOT_STARTED:
        break;
      case GAME_STATES.SETUP:
        this.playingCards = new PlayingCards(this.numCardsInPlay);
        let numCardsPerPlayer = this.players.map((player) => player.numCards);
        let hands = this.playingCards.deal(numCardsPerPlayer);
        hands.forEach((cards, i) => this.players[i].cards = cards);
        this.emitter.emit(
          GAME_EVENT.SETUP,
          GAME_EVENT.SETUP.obj(PlayerHandsObj(this.players))
        );
        break;
      case GAME_STATES.PLAYER_TURN:
        this.emitter.emit(
          GAME_EVENT.PLAYER_TURN.id,
          GAME_EVENT.PLAYER_TURN.obj(this.players[this.currentPlayerIndexTurn].id)
        );
        break;
      case GAME_STATES.PLAYER_TURN_END:
        this.emitter.emit(
          GAME_EVENT.PLAYER_PROPOSE_HAND.id,
          GAME_EVENT.PLAYER_PROPOSE_HAND.obj(
            this.players[this.currentPlayerIndexTurn].id,
            PlayerProposedHandObj(this.lastHand)
          )
        )
        this.currentPlayerIndexTurn = this.playerIndexOffset(1);
        break;
      case GAME_STATES.REVEAL:
        const isItThere = this.playingCards.isItThere(
          this.lastHand.items.flatMap((item) => {
            return Array.from(
              { length: item.count },
              (_, _) => new Card(item.value, "")
            )
          })
        );
        let [winner, loser] = isItThere ? [this.calledPlayer, this.callingPlayer] : [this.callingPlayer, this.calledPlayer];
        loser.numCards -= 1;
        this.emitter.emit(GAME_EVENT.REVEAL.id, GAME_EVENT.REVEAL.obj(PlayerHandsObj(this.players), loser.id, winner.id));
        break;
      case GAME_STATES.ROUND_OVER:
        this.numCardsInPlay -= 1;
        break;
      case GAME_STATES.GAME_OVER:
        this.emitter.emit(GAME_EVENT.GAME_OVER.id, this.players.find((player) => this.isPlayerPlaying(player)).id)
        break;
    }
  }

  // Helpers
  playerIndexOffset(offset) {
    for (let i = 0; i < this.players.length; i++) {
      const index = (this.currentPlayerIndexTurn + i + offset) % this.players.length;
      if (this.isPlayerPlaying(this.players[index]))
        return index;
    }
  }

  getPlayerIndex(player) {
    if (!this.isPlayerPlaying(player)) return -1;
    return this.players.indexOf(player);
  }

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

  endGameIfNecessary() {
    if (this.numPlayingPlayers() <= 1) {
      return this.stateMachine.transition(GameStateMachine.GAME_STATES.GAME_OVER);
    }
    return false;
  }

  playerStartTurn() {
    return this.stateMachine.transition(GameStateMachine.GAME_STATES.PLAYER_TURN);
  }

  // Player controlled calls.
  playerCalled(callingPlayer) {
    if (!this.stateMachine.verifyState(GameStateMachine.GAME_STATES.PLAYER_TURN)) return;
    let calledPlayer = this.players[this.playerIndexOffset(-1)];
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
      states[state] = new {
        transitions: GameStateMachine.VALID_TRANSITIONS[state],
      };
    }
    this.stateMachine = new StateMachine(states);
    this.emitter = this.stateMachine.emitter;
  }

  static GAME_STATES = {
    NOT_STARTED: "0",
    SETUP: "1",
    PLAYER_TURN: "2",
    PLAYER_TURN_END: "3",
    REVEAL: "4",
    ROUND_OVER: "5",
    GAME_OVER: "6",
  };

  static VALID_TRANSITIONS = (() => {
    let t = {};
    const GAME_STATES = GAME_STATES;
    t[GAME_STATES.NOT_STARTED] = [GAME_STATES.SETUP];
    t[GAME_STATES.SETUP] = [GAME_STATES.PLAYER_TURN, GAME_STATES.GAME_OVER];
    t[GAME_STATES.PLAYER_TURN] = [GAME_STATES.REVEAL, GAME_STATES.PLAYER_TURN_END, GAME_STATES.GAME_OVER];
    t[GAME_STATES.PLAYER_TURN_END] = [GAME_STATES.PLAYER_TURN, GAME_STATES.GAME_OVER];
    t[GAME_STATES.REVEAL] = [GAME_STATES.ROUND_OVER, GAME_STATES.GAME_OVER];
    t[GAME_STATES.ROUND_OVER] = [GAME_STATES.SETUP, GAME_STATES.GAME_OVER];
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
