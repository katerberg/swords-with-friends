import {Game, Messages, Player} from '../types/SharedTypes';
import {ClientGame} from './ClientGame';
import {swapScreens} from './screen-manager';

function nameChange(newName: string): void {
  globalThis.socket.emit(Messages.ChangeName, globalThis.currentGameId, newName);
}

function leaveGame(): void {
  globalThis.socket.off(Messages.GameStarted);
  globalThis.socket.off(Messages.NameChanged);
  swapScreens('waiting-room', 'start-screen');
}

async function startGame(game: Game): Promise<void> {
  const gameLobby = document.getElementById('waiting-room');
  if (gameLobby) {
    gameLobby.classList.remove('visible');
  }

  globalThis.game = new ClientGame(game);
}

export function handleStartGame(): void {
  globalThis.socket.emit(Messages.StartGame, globalThis.currentGameId);
  const gameLobby = document.getElementById('waiting-room');
  if (gameLobby) {
    gameLobby.classList.remove('visible');
  }
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
        startGameButton.ontouchend = handleStartGame;
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
  globalThis.socket.off(Messages.GameClosed);
  globalThis.socket.on(Messages.GameClosed, (gameId: string): void => {
    if (globalThis.currentGameId === gameId) {
      leaveGame();
    }
  });

  globalThis.socket.off(Messages.GameStarted);
  globalThis.socket.on(Messages.GameStarted, (gameId: string, game: Game): void => {
    if (globalThis.currentGameId === gameId) {
      startGame(game);
    }
  });

  globalThis.socket.off(Messages.NameChanged);
  globalThis.socket.on(Messages.NameChanged, (gameId: string, newPlayers: Player[]): void => {
    if (globalThis.currentGameId === gameId) {
      populatePlayerList(newPlayers);
    }
  });
}
