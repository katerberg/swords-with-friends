import {Player} from '../types/SharedTypes';

export function nameChange(newName: string): void {
  globalThis.socket.emit('changeName', globalThis.currentGameId, newName);
}

export function populatePlayerList(players: Player[]): void {
  const playerLobbyList = document.getElementById('waiting-room-list');
  if (playerLobbyList) {
    while (playerLobbyList.firstChild) {
      playerLobbyList.removeChild(playerLobbyList.firstChild);
    }

    let playerList = '<div>';
    players.forEach((player) => {
      if (player.playerId === globalThis.playerId) {
        playerList += `<div><input id="name-change-input" value="${player.name}" ></div>`;
      } else {
        playerList += `<div>${player.name}${player.isHost ? '*' : ''}</div>`;
      }
    });
    playerList += '</div>';
    playerLobbyList.innerHTML = playerList;
    const input = document.getElementById('name-change-input');
    if (input) {
      input.onchange = (event: Event): void => {
        const newName = (event?.target as HTMLInputElement)?.value;
        nameChange(newName);
      };
    }
  }

  socket.off('nameChanged');
  socket.on('nameChanged', (gameId: string, newPlayers: Player[]): void => {
    if (globalThis.currentGameId === gameId) {
      populatePlayerList(newPlayers);
    }
  });
}
