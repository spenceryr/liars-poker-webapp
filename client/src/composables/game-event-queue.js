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

export const GAME_EVENTS = {
  INITIALIZE: 'INITIALIZE',
  SETUP: 'SETUP',
  PLAYER_TURN: 'PLAYER_TURN',
  PLAYER_PROPOSE_HAND: 'PLAYER_PROPOSE_HAND',
  REVEAL: 'PLAYER_PROPOSE_HAND'
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

  /**
   *
   * @param {GameEvent} event
   */
  function push(event) {
    const promise = createQueuePromise(event);
    promiseQueue.push(promise);
  }

  /**
   *
   * @param {GameEvent} event
   */
  async function createQueuePromise(event) {
    await Promise.all(promiseQueue);
    currentGameEvent.value = event;
    await Promise.resolve(event.consumed);
    promiseQueue.shift();
    if (promiseQueue.length === 0) currentGameEvent.value = null;
  }

  watch(gameEvent, (newGameEvent) => {
    const gameEvent = toValue(newGameEvent);
    if (!checkTypes([gameEvent, gameEvent.event], ['object', 'string'])) return;
    switch (gameEvent.event) {
      case GAME_EVENTS.INITIALIZE: {
        const snapshot = gameEvent.snapshot;
        if (checkType(snapshot, 'null')) return;
        if (!checkType(snapshot, 'object')) return;
        if (!checkTypes(
          [snapshot.gameState, snapshot.currentPlayerTurn, snapshot.lastHand, snapshot.lastHandPlayer,
            snapshot.playersOrder, snapshot.playersNumCards, snapshot.playerHand],
          ['string', 'string', 'array', 'string', 'array', 'object', 'array']
        )) return;
        push(new GameEvent(GAME_EVENTS.INITIALIZE, snapshot));
        break;
      }
      case GAME_EVENTS.SETUP: {
        if (!checkTypes([gameEvent.playerHand, gameEvent.playersOrder, gameEvent.playersNumCards],
          ['array', 'array', 'object'])) return;
        const { event: _, ...data } = gameEvent;
        push(new GameEvent(GAME_EVENTS.SETUP, data));
        break;
      }
      case GAME_EVENTS.PLAYER_TURN: {
        if (!checkType(gameEvent.player, 'string')) return;
        const { event: _, ...data } = gameEvent;
        push(new GameEvent(GAME_EVENTS.PLAYER_TURN, data));
        break;
      }
      case GAME_EVENTS.PLAYER_PROPOSE_HAND: {
        if (!checkTypes([gameEvent.player, gameEvent.proposedHand], ['string', 'array'])) return;
        const { event: _, ...data } = gameEvent;
        push(new GameEvent(GAME_EVENTS.PLAYER_PROPOSE_HAND, data));
        break;
      }
      case GAME_EVENTS.REVEAL: {
        if (!checkTypes([gameEvent.allPlayersCards, gameEvent.winner, gameEvent.loser],
          ['object', 'string', 'string'])) return;
        const { event: _, ...data } = gameEvent;
        push(new GameEvent(GAME_EVENTS.REVEAL, data));
        break;
      }
    }
  });

  return { currentGameEvent: currentGameEvent };
}
