import { StateMachine } from "./state-machine";
import { Player } from "./player";
import EventEmitter from "events";

export class Game {
  static get PLAYERS_MAX() { return 6; }

  constructor(players, startingPlayer) {
    let numPlayers = players.length;
    if (numPlayers > PLAYERS_MAX) throw new Error("Can't have a game with more than ${Game.PLAYERS_MAX} players");
    let startingPlayerIndex = players.findIndex(startingPlayer);
    assert(startingPlayerIndex !== -1);
    this.players = players;
    this.numCardsInPlay = numPlayers * Player.NUM_STARTING_CARDS;
    this.playingCards = null;
    this.currentPlayerIndexTurn = startingPlayerIndex;
    this.callingPlayer = null;
    this.calledPlayer = null;
    this.lastHand = null;
    this.stateMachine = new GameStateMachine(this);
    this.stateMachine.emitter.on("state_change", this.handleStateChange);
    this.emitter = new EventEmitter();
  }

  start() {
    this.stateMachine.transition(GameStateMachine.GAME_STATES.SETUP);
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
        break;
      case GAME_STATES.PLAYER_TURN:
        break;
      case GAME_STATES.PLAYER_TURN_END:
        this.currentPlayerIndexTurn = this.playerOffset(1);
        break;
      case GAME_STATES.REVEAL:

        break;
      case GAME_STATES.ROUND_OVER:
        this.numCardsInPlay -= 1;
        break;
      case GAME_STATES.GAME_OVER:
        break;
    }
  }

  playerOffset(offset) {
    return (this.currentPlayerIndexTurn + offset) % this.players.length;
  }

  getPlayerIndex(player) {
    return this.players.findIndex(player);
  }

  playerCalled(callingPlayer) {
    if (!this.stateMachine.verifyState(GameStateMachine.GAME_STATES.PLAYER_TURN)) return;
    let calledPlayer = this.playerOffset(-1);
    let callingPlayerIndex = this.getPlayerIndex(callingPlayer);
    if (callingPlayerIndex === -1) return;
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
    t[this.GAME_STATES.NOT_STARTED] = [this.GAME_STATES.SETUP];
    t[this.GAME_STATES.SETUP] = [this.GAME_STATES.PLAYER_TURN, this.GAME_STATES.GAME_OVER];
    t[this.GAME_STATES.PLAYER_TURN] = [this.GAME_STATES.REVEAL, this.GAME_STATES.PLAYER_TURN_END, this.GAME_STATES.GAME_OVER];
    t[this.GAME_STATES.PLAYER_TURN_END] = [this.GAME_STATES.PLAYER_TURN, this.GAME_STATES.GAME_OVER];
    t[this.GAME_STATES.REVEAL] = [this.GAME_STATES.ROUND_OVER, this.GAME_STATES.GAME_OVER];
    t[this.GAME_STATES.ROUND_OVER] = [this.GAME_STATES.SETUP, this.GAME_STATES.GAME_OVER];
    t[this.GAME_STATES.GAME_OVER] = [];
    return t;
  })();

  transition(nextState) {
    this.stateMachine.transition(nextState);
  }

  verifyState(...states) {
    this.stateMachine.verifyState(...states);
  }
}
