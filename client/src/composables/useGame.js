import { watch, toValue, shallowRef } from "vue";
import { checkType, checkTypes } from "/@/utilities/checkType";

export function useGame(gameEvent) {
  let playersCardMap = shallowRef(null);
  let playerHand = shallowRef(null);
  let playersOrder = shallowRef(null);
  let currentPlayerTurn = shallowRef(null);
  let lastHand = shallowRef(null);
  // Game/Round start transition (playersCardMap change)
  // Player start turn transition (currentPlayerTurn change)
  // Player turn screen or player wait on turn screen
  // Player propose transition (lastHand change)
  // Player call/reveal transition (playersCardMap change)
  // Show winner transition

  watch(gameEvent, (newGameEvent) => {
    let gameEvent = toValue(newGameEvent);
    if (!checkTypes([gameEvent, gameEvent.event], ['object', 'string'])) return;
    switch (gameEvent.event) {
      case 'INITIALIZE': {
        let snapshot = gameEvent.snapshot;
        if (checkType(snapshot, 'null')) return;
        if (!checkType(snapshot, 'object')) return;
        let snapGameState = snapshot.gameState;
        let snapCurrentPlayerTurn = snapshot.currentPlayerTurn;
        let snapLastHand = snapshot.lastHand;
        let snapPlayersOrder = snapshot.playersOrder;
        let snapPlayersNumCards = snapshot.playersNumCards;
        let snapPlayerHand = snapshot.playerHand;
        if (!checkTypes(
          [snapGameState, snapCurrentPlayerTurn, snapLastHand, snapPlayersOrder, snapPlayersNumCards, snapPlayerHand],
          ['string', 'string', 'array', 'array', 'object', 'array']
        )) return;
        playersCardMap.value = snapPlayersNumCards;
        playerHand.value = snapPlayerHand;
        playersOrder.value = snapPlayersOrder;
        currentPlayerTurn.value = snapCurrentPlayerTurn;
        lastHand.value = snapLastHand;
        break;
      }
      case 'SETUP': {
        let newPlayerHand = gameEvent.playerHand;
        let newPlayersOrder = gameEvent.playersOrder;
        let newPlayersNumCards = gameEvent.playersNumCards;
        if (!checkTypes([newPlayerHand, newPlayersOrder, newPlayersNumCards], ['array', 'array', 'object'])) return;
        // TODO: (spencer) Use state change queue to allow for transitions and temporary display before actually changing state.
        playerHand.value = newPlayerHand;
        playersOrder.value = newPlayersOrder;
        playersCardMap.value = newPlayersNumCards;
        break;
      }
      case 'PLAYER_TURN': {
        let player = gameEvent.player;
        if (!checkType(player, 'string')) return;
        currentPlayerTurn.value = player;
        break;
      }
      case 'PLAYER_PROPOSE_HAND': {
        let player = gameEvent.player;
        let proposedHand = gameEvent.proposedHand;
        if (!checkTypes([player, proposedHand], ['string', 'array'])) return;
        currentPlayerTurn = player;
        lastHand.value = proposedHand;
        break;
      }
      case 'REVEAL': {
        let allPlayersCards = gameEvent.allPlayerCards;
        let winner = gameEvent.winner;
        let loser = gameEvent.loser;
        if (!checkTypes([allPlayersCards, winner, loser], ['object', 'string', 'string'])) return;
        playersCardMap.value = allPlayersCards;
        break;
      }
    }
  });

  return { players, lastWinner, inPreGameLobby };
}
