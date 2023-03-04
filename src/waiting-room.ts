import {Player} from '../types/SharedTypes';
import {Game} from './Game';

function nameChange(newName: string): void {
  globalThis.socket.emit('changeName', globalThis.currentGameId, newName);
}

function startGame(): void {
  const gameLobby = document.getElementById('waiting-room');
  if (gameLobby) {
    gameLobby.classList.remove('visible');
  }
  globalThis.game = new Game();
}

function handleStartGame(): void {
  globalThis.socket.emit('startGame', globalThis.currentGameId);
  startGame();
}

export function populatePlayerList(players: Player[]): void {
  const playerLobbyList = document.getElementById('waiting-room-list');
  if (playerLobbyList) {
    while (playerLobbyList.firstChild) {
      playerLobbyList.removeChild(playerLobbyList.firstChild);
    }

    let isHost = false;
    let playerList = '<div class="player-list">';
    players.forEach((player) => {
      if (player.playerId === globalThis.playerId) {
        playerList += `<div><input id="name-change-input" value="${player.name}" ></div>`;
        ({isHost} = player);
      } else {
        playerList += `<div>${player.name}${player.isHost ? '*' : ''}</div>`;
      }
    });
    playerList += '</div>';
    if (isHost) {
      playerList += '<button id="start-game">Start Game</button>';
    }

    playerLobbyList.innerHTML = playerList;
    if (isHost) {
      const startGameButton = document.getElementById('start-game');
      if (startGameButton) {
        startGameButton.onclick = handleStartGame;
      }
    }
    const input = document.getElementById('name-change-input');
    if (input) {
      input.onchange = (event: Event): void => {
        const newName = (event?.target as HTMLInputElement)?.value;
        nameChange(newName);
      };
    }
  }
  socket.off('gameStarted');
  socket.on('gameStarted', (gameId: string): void => {
    if (globalThis.currentGameId === gameId) {
      startGame();
    }
  });

  socket.off('nameChanged');
  socket.on('nameChanged', (gameId: string, newPlayers: Player[]): void => {
    if (globalThis.currentGameId === gameId) {
      populatePlayerList(newPlayers);
    }
  });
}
