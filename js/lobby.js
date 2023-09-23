import { Player, Game } from "./types";

export class Lobby {
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
