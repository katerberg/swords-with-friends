import {Player} from '../types/SharedTypes';

export function populatePlayerList(players: Player[]): void {
  const playerLobbyList = document.getElementById('waiting-room-list');
  if (playerLobbyList) {
    while (playerLobbyList.firstChild) {
      playerLobbyList.removeChild(playerLobbyList.firstChild);
    }

    let playerList = '<div>';
    players.forEach((player) => {
      playerList += `<div>${player.playerId}</div>`;
    });
    playerList += '</div>';
    playerLobbyList.innerHTML = playerList;
  }
}
