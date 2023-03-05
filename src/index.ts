import './index.scss';
import './start-screen.scss';
import './waiting-room.scss';
import './games-lobby.scss';
import * as paper from 'paper';
import {io} from 'socket.io-client';
import {Game, Messages} from '../types/SharedTypes';
import {swapScreens} from './screen-manager';
import {populatePlayerList} from './waiting-room';

// screen.orientation?.lock('portrait');

function initCanvasSize(canvas: HTMLCanvasElement): void {
  const width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
  const height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
  canvas.width = 1000; //horizontal resolution (?) - increase for better looking text
  canvas.height = 1778; //vertical resolution (?) - increase for better looking text
  canvas.style.width = `${width}`; //actual width of canvas
  canvas.style.height = `${height}`; //actual height of canvas
  globalThis.gameElement = canvas;
}

function populateGameGlobals(gameId: string, playerId: string): void {
  globalThis.playerId = playerId;
  globalThis.currentGameId = gameId;
}

async function handleCreateGame(): Promise<void> {
  const createdGame: Game = await fetch(`http://localhost:8081/api/games?socketId=${globalThis.socket.id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  }).then((response) => response.json());
  populateGameGlobals(createdGame.gameId, createdGame.players[createdGame.players.length - 1].playerId);
  globalThis.socket.on(Messages.PlayersChangedInGame, (game) => {
    populatePlayerList(game.players);
  });
  swapScreens('start-screen', 'waiting-room');
  populatePlayerList(createdGame.players);
}

async function joinGame(gameId: string): Promise<void> {
  const joinedGame: Game = await fetch(`http://localhost:8081/api/games/${gameId}?socketId=${globalThis.socket.id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  }).then((response) => response.json());
  swapScreens('games-lobby', 'waiting-room');
  populateGameGlobals(joinedGame.gameId, joinedGame.players[joinedGame.players.length - 1].playerId);
  populatePlayerList(joinedGame.players);
}

function joinGameHandler(event: MouseEvent): void {
  const button = event.target as HTMLElement;
  const gameId = button.getAttribute('data-game-id');
  if (gameId) {
    joinGame(gameId);
  }
}

function populateGamesList(games: Game[]): void {
  const gamesLobbyList = document.getElementById('games-lobby-list');
  if (gamesLobbyList) {
    while (gamesLobbyList.firstChild) {
      gamesLobbyList.removeChild(gamesLobbyList.firstChild);
    }

    let gameList = '<div>';
    games.forEach((game) => {
      gameList += `<div><span>${game.gameId}</span><button class="join" data-game-id="${game.gameId}">Join</button></div>`;
    });
    gameList += '</div>';
    gamesLobbyList.innerHTML = gameList;
    const allButtons: NodeListOf<HTMLElement> = document.querySelectorAll('button[class=join]');

    for (let i = 0; i < allButtons.length; i++) {
      if (allButtons[i]) {
        allButtons[i].onclick = joinGameHandler;
      }
    }
  }
}

async function openGamesList(): Promise<void> {
  swapScreens('start-screen', 'games-lobby');
  const games = await fetch('http://localhost:8081/api/games', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  }).then((response) => response.json());
  populateGamesList(games);
  globalThis.socket.off(Messages.CurrentGames);
  globalThis.socket.on(Messages.CurrentGames, (gamesList) => {
    populateGamesList(gamesList);
  });
}

function cancelGamesLobby(): void {
  globalThis.socket.off(Messages.CurrentGames);
  swapScreens('games-lobby', 'start-screen');
}

function cancelWaitingRoom(): void {
  globalThis.socket.emit(Messages.LeaveGame, currentGameId);
  globalThis.socket.off(Messages.GameStarted);
  globalThis.socket.off(Messages.NameChanged);
  swapScreens('waiting-room', 'start-screen');
}

window.addEventListener('load', () => {
  const gameElement = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (gameElement) {
    gameElement.onwheel = (event): void => {
      event.preventDefault();
    };

    initCanvasSize(gameElement);
    paper.setup(globalThis.gameElement);

    const createGameButton = document.getElementById('create-game');
    if (createGameButton) {
      createGameButton.onclick = handleCreateGame;
    }

    const openGamesListButton = document.getElementById('open-games-list');
    if (openGamesListButton) {
      openGamesListButton.onclick = openGamesList;
    }

    const gamesLobbyCancelButton = document.getElementById('games-lobby-cancel-button');
    if (gamesLobbyCancelButton) {
      gamesLobbyCancelButton.onclick = cancelGamesLobby;
    }

    const waitingRoomCancelButton = document.getElementById('waiting-room-cancel-button');
    if (waitingRoomCancelButton) {
      waitingRoomCancelButton.onclick = cancelWaitingRoom;
    }

    globalThis.socket = io('http://localhost:8081');
  }
});
