import './index.scss';
import './start-screen.scss';
import './game-lobby.scss';
import './games-lobby.scss';
import * as paper from 'paper';
import {io} from 'socket.io-client';
import {BLACK} from './colors';

type Player = {
  x: number;
  y: number;
  playerId: string;
  isHost: boolean;
};
enum GameStatus {
  WaitingForPlayers,
  Ongoing,
  Saved,
  Done,
}
type Game = {gameId: string; players: Player[]; status: GameStatus};

// screen.orientation?.lock('portrait');

let socketId: paper.PointText;

function initCanvasSize(canvas: HTMLCanvasElement): void {
  const width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
  const height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
  canvas.width = 1000; //horizontal resolution (?) - increase for better looking text
  canvas.height = 1778; //vertical resolution (?) - increase for better looking text
  canvas.style.width = `${width}`; //actual width of canvas
  canvas.style.height = `${height}`; //actual height of canvas
  globalThis.gameElement = canvas;
}

function drawSocketId(socket: string): void {
  socketId?.remove();
  socketId = new paper.PointText({
    point: paper.view.center.transform(new paper.Matrix().translate(0, 230)),
    justification: 'center',
    fontSize: 20,
    fillColor: BLACK,
    content: `Socket ID
    ${socket}`,
  });
}

async function handleCreateGame(): Promise<void> {
  await fetch('http://localhost:8081/api/games', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  globalThis.socket.on('currentGames', (gamesList) => {
    drawSocketId(globalThis.socket.id);
    console.log('games', gamesList); //eslint-disable-line no-console
  });
  globalThis.socket.on('joinedGame', (game) => {
    console.log('game join', game); //eslint-disable-line no-console
  });
  const startScreen = document.getElementById('start-screen');
  const gameLobby = document.getElementById('game-lobby');
  if (startScreen && gameLobby) {
    gameLobby.classList.add('visible');
    startScreen.classList.remove('visible');
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
      gameList += `<div>${game.gameId}</div>`;
    });
    gameList += '</div>';
    gamesLobbyList.innerHTML = gameList;
  }
}

async function openGamesList(): Promise<void> {
  const startScreen = document.getElementById('start-screen');
  const gamesLobbyScreen = document.getElementById('games-lobby');
  if (startScreen && gamesLobbyScreen) {
    gamesLobbyScreen.classList.add('visible');
    startScreen.classList.remove('visible');
  }
  const games = await fetch('http://localhost:8081/api/games', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  }).then((response) => response.json());
  populateGamesList(games);
  console.log('games', games); //eslint-disable-line no-console
  globalThis.socket.on('currentGames', (gamesList) => {
    console.log('games', gamesList); //eslint-disable-line no-console
    populateGamesList(gamesList);
  });
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
    globalThis.socket = io('http://localhost:8081');
  }
});
