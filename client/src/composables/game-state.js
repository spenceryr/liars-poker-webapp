import { watch, toValue, shallowRef } from 'vue'
import { GAME_EVENTS } from '/@/composables/game-event-queue.js';

export function useGameState(thisPlayerID, currentEvent) {
  const playersToCardsMap = shallowRef(null);
  const playerHand = shallowRef(null);
  const playersOrder = shallowRef(null);
  const currentPlayerTurn = shallowRef(null);
  const lastPlayerTurn = shallowRef(null);
  const lastHand = shallowRef(null);
  const winner = shallowRef(null);
  const loser = shallowRef(null);
  const caller = shallowRef(null);
  const canCall = shallowRef(false);
  const gameHasEnded = shallowRef(false);
  const gameWinner = shallowRef(null);

  watch(currentEvent, async (newEvent) => {
    const event = toValue(newEvent);
    if (!event) return;
    // TODO: (spencer) Validate event data.
    switch (event.type) {
      case GAME_EVENTS.INITIALIZE: {
        console.debug(`Game processing INITIALIZE: ${JSON.stringify(event.data)}`);
        const data = event.data;
        currentPlayerTurn.value = data.currentPlayerTurn;
        lastHand.value = data.lastHand;
        lastPlayerTurn.value = data.lastHandPlayer;
        playersOrder.value = data.playersOrder;
        playersToCardsMap.value = data.playersNumCards;
        playerHand.value = data.playerHand;
        gameWinner.value = data.gameWinner;
        if (data.gameWinner) {
          gameHasEnded.value = true;
        }
        break;
      }
      case GAME_EVENTS.SETUP: {
        console.debug(`Game processing SETUP: ${JSON.stringify(event.data)}`);
        const data = event.data;
        playersOrder.value = data.playersOrder;
        playerHand.value = data.playerHand;
        playersToCardsMap.value = data.playersNumCards;
        lastHand.value = null;
        currentPlayerTurn.value = null;
        lastPlayerTurn.value = null;
        winner.value = null;
        loser.value = null;
        caller.value = null;
        canCall.value = false;
        gameWinner.value = null;
        gameHasEnded.value = false;
        break;
      }
      case GAME_EVENTS.PLAYER_TURN: {
        console.debug(`Game processing PLAYER_TURN: ${JSON.stringify(event.data)}`);
        const data = event.data;
        currentPlayerTurn.value = data.player;
        canCall.value = lastPlayerTurn.value && lastPlayerTurn.value !== toValue(thisPlayerID);
        break;
      }
      case GAME_EVENTS.PLAYER_PROPOSE_HAND: {
        console.debug(`Game processing PLAYER_PROPOSE_HAND: ${JSON.stringify(event.data)}`);
        const data = event.data;
        lastPlayerTurn.value = data.player;
        lastHand.value = data.proposedHand;
        currentPlayerTurn.value = null;
        canCall.value = false;
        break;
      }
      case GAME_EVENTS.REVEAL: {
        console.debug(`Game processing REVEAL: ${JSON.stringify(event.data)}`);
        const data = event.data;
        playersToCardsMap.value = data.allPlayersCards;
        currentPlayerTurn.value = null;
        canCall.value = false;
        caller.value = [data.winner, data.loser].filter((player) => lastPlayerTurn.value !== player)[0];
        console.debug(`Setting caller to ${caller.value}`);
        await new Promise((resolve) => setTimeout(resolve, 3 * 1000));
        caller.value = null;
        winner.value = data.winner;
        loser.value = data.loser;
        await new Promise((resolve) => setTimeout(resolve, 5 * 1000));
        break;
      }
      case GAME_EVENTS.GAME_OVER: {
        console.debug(`Game processing GAME_OVER: ${JSON.stringify(event.data)}`);
        const data = event.data;
        gameHasEnded.value = true;
        gameWinner.value = data.winner;
        canCall.value = false;
        currentPlayerTurn.value = null;
        break;
      }
    }
    event.consume();
  }, { immediate: true });

  return {
    playersToCardsMap,
    playerHand,
    playersOrder,
    currentPlayerTurn,
    lastPlayerTurn,
    lastHand,
    winner,
    loser,
    caller,
    canCall,
    gameHasEnded,
    gameWinner
  };
}
