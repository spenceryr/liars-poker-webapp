class Card {
  constructor(value, suit) {
    this.value = value;
    this.suit = suit;
  }

  static get MAX_VALUE() { return 14; }
  static get MIN_VALUE() { return 2; }
}

class PlayerCustomHand {
  constructor() {
    this.items = [];
    this.count = 0;
    this.highestItemCount = 0;
    this.highestItemValue = 0;
  }

  static get COUNT_MAX() { return 5 };

  /**
   *
   * @param {PlayerCustomHandItem} item
   * @returns
   */
  addItem(item) {
    if (this.count > PlayerCustomHand.COUNT_MAX - item.count) return;
    this.items.push(item);
    this.count += item.count;
    if (item.count >= this.highestItemCount) {
      this.highestItemCount = item.count;
      if (item.value >= this.highestItemValue) {
        this.highestItemValue = item.value;
      }
    }
    let insertIndex = this.items.length;
    for (const [index, existingItem] of this.items.entries()) {
      if (item.count > existingItem.count) {
        insertIndex = index;
        break;
      } else if (item.count == existingItem.count && item.value > existingItem.value) {
        insertIndex = index;
        break;
      }
    }
    this.items.splice(insertIndex, 0, item);
  }

  removeItem(item) {
    let index = this.items.findIndex((element) => element.count == item.count && element.value == item.value);
    if (typeof index == "undefined") return;
    delete items[index];
    this.count -= item.count;
  }

  compare(against) {
    const min = Math.min(this.items.length, against.items.length);
    for (let i = 0; i < min; i++) {
      let thisItem = this.items[i];
      let againstItem = against.items[i];
      if (thisItem.count == againstItem.count) {
        if (thisItem.value == againstItem.value) {
          continue;
        }
        return thisItem.value > againstItem.value ? 1 : -1;
      }
      return thisItem.count > againstItem.count ? 1 : -1;
    }
    if (this.items.length == against.items.length) {
      return 0;
    }
    return this.items.length > against.items.length ? 1 : -1;
  }
}

class PlayerCustomHandItem {
  /**
   *
   * @param {number} value
   * @param {number} count
   */
  constructor(value, count) {
    if (value > Card.MAX_VALUE) value = Card.MAX_VALUE;
    else if (value < Card.MIN_VALUE) value = Card.MIN_VALUE;
    if (count > PlayerCustomHandItem.MAX_COUNT) count = PlayerCustomHandItem.MAX_COUNT;
    else if (count <= PlayerCustomHandItem.MIN_COUNT) count = PlayerCustomHandItem.MIN_COUNT;
    this.value = value;
    this.count = count;
  }

  static get MAX_COUNT() { return 4; }
  static get MIN_COUNT() { return 1; }
}

// 2*13 2*12 14 = 61544
// 2*14 2*2 =

class PlayingCards {
  constructor(numCards) {
    this.cardsInPlay = [];
    let deckCopy = [...FULL_DECK];
    for (let i = 0; i < numCards; i++) {
      let index = Math.floor(Math.random() * (52 - i));
      this.cardsInPlay.push(deckCopy[index]);
      deckCopy.splice(index, 1);
    }
  }

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


  static FULL_DECK = (() => {
    var values = [...Array(Card.MAX_VALUE - Card.MIN_VALUE + 1).keys()].map((_, i) => i + Card.MIN_VALUE);
    var suits = ["D", "C", "S", "H"];
    return values.flatMap((v) => suits.map((s) => { return new Card(v, s) }));
  })();
}

class Player {
  static get NUM_STARTING_CARDS() { return 5 };

  constructor(id) {
    this.numCards = NUM_STARTING_CARDS;
    this.cards = undefined;
    this.id = id;
  }
}

class GameStateMachine {
  constructor(game) {
    this.game = game;
    this.state = GameStateMachine.GAME_STATES.NOT_STARTED;
  }

  static GAME_STATES = {
    NOT_STARTED: 0,
    SETUP: 1,
    PLAYER_TURN: 2,
    PLAYER_TURN_END: 3,
    REVEAL: 4,
    ROUND_OVER: 5,
    GAME_OVER: 6,
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

  transitionFuncs = (() => {
    let t = {};
    t[GameStateMachine.GAME_STATES.NOT_STARTED] = () => {};
    t[GameStateMachine.GAME_STATES.SETUP] = this.onSetup;
    t[GameStateMachine.GAME_STATES.PLAYER_TURN] = this.onPlayerTurn;
    t[GameStateMachine.GAME_STATES.PLAYER_TURN_END] = this.onPlayerTurnEnd;
    t[GameStateMachine.GAME_STATES.REVEAL] = this.onReveal;
    t[GameStateMachine.GAME_STATES.ROUND_OVER] = this.onRoundOver;
    t[GameStateMachine.GAME_STATES.GAME_OVER] = this.onGameOver;
    return t;
  })();

  transition(nextState) {
    if (Game.VALID_TRANSITIONS[this.state].includes(nextState)) {
      this.state = nextState;
      this.transitionFuncs[nextState]();
    }
  }

  onSetup() {
    this.game.playingCards = new PlayingCards(this.game.numCardsInPlay);
    let numCardsPerPlayer = this.game.players.map((player) => player.numCards);
    let hands = this.game.playingCards.deal(numCardsPerPlayer);
    hands.forEach((cards, i) => this.game.players[i].cards = cards);
  }
  onPlayerTurn() {

  }
  onPlayerTurnEnd() {
    this.game.currentPlayerTurn = (this.game.currentPlayerIndexTurn + 1) % this.game.players.length;
  }
  onReveal() {

  }
  onRoundOver() {
    this.game.numCardsInPlay -= 1;
  }
  onGameOver() {

  }
}

class PreGameLobby {
  constructor(id, password) {
    this.players = [];
    this.id = id;
    this.acceptingNewPlayers = true;
    this.lobbyPassword = password;
  }

  playerJoined(playerID) {
    if (!this.acceptingNewPlayers) return false;
    this.players.push(new Player(playerID));
    if (this.players.length >= Game.PLAYERS_MAX) this.acceptingNewPlayers = false;
    return true;
  }

  playerLeft(playerID) {
    let index = this.players.findIndex((player) => player.id == playerID);
    if (index == -1) return;
    this.players.splice(index, 1);
    this.acceptingNewPlayers = true;
  }
}

class Game {
  static get PLAYERS_MAX() { return 6; }

  constructor(playerIDs, startingPlayerID) {
    let numPlayers = playerIDs.length;
    if (numPlayers > PLAYERS_MAX) throw new Error("Can't have a game with more than ${Game.PLAYERS_MAX} players");
    if (!playerIDs.includes(startingPlayerID)) throw new Error("PlayerID for starting player not found");
    this.players = [...Array(numPlayers).keys()].map((i) => new Player(playerIDs[i]));
    this.numCardsInPlay = numPlayers * Player.NUM_STARTING_CARDS;
    this.playingCards = undefined;
    this.currentPlayerIndexTurn = startingPlayerID;
    this.stateMachine = GameStateMachine();
  }

  playerCalled(callingPlayer) {

  }
  playerProposedHand(hand) {

  }
}

function main() {
  const http = require('http');

  const hostname = '127.0.0.1';
  const port = 3000;

  const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Hello World');
  });

  server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
  });
}
