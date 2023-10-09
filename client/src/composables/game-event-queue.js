import { watch, toValue, shallowRef } from "vue";
import { checkType, checkTypes } from "/@/utilities/checkType";

export class GameEvent {
  constructor(type, data) {
    this.type = type;
    this.data = data;
    this.consumed = new Promise((resolve) => { this.resolver = resolve; });
    this._consumeCalled = false;
  }

  consume() {
    if (this._consumeCalled) return;
    this._consumeCalled = true;
    this.resolver();
  }
}

/**
 *
 * @param {import("vue").Ref} gameEvent
 * @returns
 */
export function useGameEventQueue(gameEvent) {
  const promiseQueue = [];
  /** @type {import("vue").ShallowRef<GameEvent?>} */
  const currentGameEvent = shallowRef(null);
  // Game/Round start transition (playersCardMap change)
  // Player start turn transition (currentPlayerTurn change)
  // Player turn screen or player wait on turn screen
  // Player propose transition (lastHand change)
  // Player call/reveal transition (playersCardMap change)
  // Show winner transition

  function push(event) {
    const promise = createQueuePromise(event);
    promiseQueue.push(promise);
  }

  async function createQueuePromise(event) {
    await Promise.all(promiseQueue);
    currentGameEvent.value = event;
    await Promise.resolve(event.consumed);
    promiseQueue.shift();
  }

  watch(gameEvent, (newGameEvent) => {
    const gameEvent = toValue(newGameEvent);
    if (!checkTypes([gameEvent, gameEvent.event], ['object', 'string'])) return;
    switch (gameEvent.event) {
      case 'INITIALIZE': {
        const snapshot = gameEvent.snapshot;
        if (!checkType(snapshot, 'object')) return;
        const snapGameState = snapshot.gameState;
        const snapCurrentPlayerTurn = snapshot.currentPlayerTurn;
        const snapLastHand = snapshot.lastHand;
        const snapPlayersOrder = snapshot.playersOrder;
        const snapPlayersNumCards = snapshot.playersNumCards;
        const snapPlayerHand = snapshot.playerHand;
        if (!checkTypes(
          [snapGameState, snapCurrentPlayerTurn, snapLastHand, snapPlayersOrder, snapPlayersNumCards, snapPlayerHand],
          ['string', 'string', 'array', 'array', 'object', 'array']
        )) return;
        push(new GameEvent('INITIALIZE', {
          playersCardMap: snapPlayersNumCards,
          playerHand: snapPlayerHand,
          playersOrder: snapPlayersOrder,
          currentPlayerTurn: snapCurrentPlayerTurn,
          lastHand: snapLastHand,
        }));
        break;
      }
      case 'SETUP': {
        const newPlayerHand = gameEvent.playerHand;
        const newPlayersOrder = gameEvent.playersOrder;
        const newPlayersNumCards = gameEvent.playersNumCards;
        if (!checkTypes([newPlayerHand, newPlayersOrder, newPlayersNumCards], ['array', 'array', 'object'])) return;
        push(new GameEvent('SETUP', {
          playersCardMap: newPlayersNumCards,
          playerHand: newPlayerHand,
          playersOrder: newPlayersOrder,
        }));
        break;
      }
      case 'PLAYER_TURN': {
        const player = gameEvent.player;
        if (!checkType(player, 'string')) return;
        push(new GameEvent('PLAYER_TURN', {
          player: player,
        }));
        break;
      }
      case 'PLAYER_PROPOSE_HAND': {
        const player = gameEvent.player;
        const proposedHand = gameEvent.proposedHand;
        if (!checkTypes([player, proposedHand], ['string', 'array'])) return;
        push(new GameEvent('PLAYER_PROPOSE_HAND', {
          player: player,
          proposedHand: proposedHand
        }));
        break;
      }
      case 'REVEAL': {
        const allPlayersCards = gameEvent.allPlayersCards;
        const winner = gameEvent.winner;
        const loser = gameEvent.loser;
        if (!checkTypes([allPlayersCards, winner, loser], ['object', 'string', 'string'])) return;
        push(new GameEvent('REVEAL', {
          allPlayersCards: allPlayersCards,
          winner: winner,
          loser: loser
        }));
        break;
      }
    }
  });

  return { currentGameEvent: currentGameEvent };
}
