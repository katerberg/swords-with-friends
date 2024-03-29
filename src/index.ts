import './index.scss';
import './start-screen.scss';
import './waiting-room.scss';
import './end-screen.scss';
import './games-lobby.scss';
import * as paper from 'paper';
import {io} from 'socket.io-client';
import {Game, GameStatus, Messages} from '../types/SharedTypes';
import {ClientGame} from './ClientGame';
import {API_BASE, LOCAL_STORAGE_GAME_ID, LOCAL_STORAGE_PLAYER_ID, SOCKET_BASE} from './consts';
import {isDebug} from './debug';
import {clearLocalStorage, loseGame, swapScreens, winGame} from './screen-manager';
import {handleStartGame, populatePlayerList} from './waiting-room';

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
  localStorage.setItem(LOCAL_STORAGE_GAME_ID, gameId);
  localStorage.setItem(LOCAL_STORAGE_PLAYER_ID, playerId);
}

function goToWaitingRoom(createdGame: Game): void {
  globalThis.socket.on(Messages.PlayersChangedInGame, (game) => {
    populatePlayerList(game.players);
  });
  const waitingRoomTitle = document.getElementById('waiting-room-title');
  if (waitingRoomTitle) {
    waitingRoomTitle.innerHTML = 'Waiting Room';
  }
  swapScreens('start-screen', 'waiting-room');
  populatePlayerList(createdGame.players);
}

async function handleCreateGame(): Promise<void> {
  const createdGame: Game = await fetch(`${API_BASE}/games?socketId=${globalThis.socket.id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  }).then((response) => response.json());
  populateGameGlobals(createdGame.gameId, createdGame.players[createdGame.players.length - 1].playerId);
  goToWaitingRoom(createdGame);
}

async function joinGame(gameId: string): Promise<void> {
  const joinedGame: Game = await fetch(`${API_BASE}/games/${gameId}?socketId=${globalThis.socket.id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  }).then((response) => response.json());
  swapScreens('games-lobby', 'waiting-room');
  populateGameGlobals(joinedGame.gameId, joinedGame.players[joinedGame.players.length - 1].playerId);
  populatePlayerList(joinedGame.players);
}

function joinGameHandler(event: TouchEvent | MouseEvent): void {
  const button = event.target as HTMLElement;
  const gameId = button.getAttribute('data-game-id');
  if (gameId) {
    joinGame(gameId);
  }
}

function populateGamesList(games: Game[]): void {
  const gamesLobbyList = document.getElementById('games-lobby-list');
  if (gamesLobbyList) {
    const noGamesMessage = document.getElementById('games-lobby-no-games');
    if (noGamesMessage) {
      if (games.length) {
        noGamesMessage.classList.remove('visible');
      } else {
        noGamesMessage.classList.add('visible');
      }
    }
    while (gamesLobbyList.firstChild) {
      gamesLobbyList.removeChild(gamesLobbyList.firstChild);
    }

    let gameList = '<div>';
    games.forEach((game) => {
      gameList += `<div><span>${
        game.players.find((player) => player.isHost)?.name
      }’s Game</span><button class="join" data-game-id="${game.gameId}">Join</button></div>`;
    });
    gameList += '</div>';
    gamesLobbyList.innerHTML = gameList;
    const allButtons: NodeListOf<HTMLElement> = document.querySelectorAll('button[class=join]');

    for (let i = 0; i < allButtons.length; i++) {
      if (allButtons[i]) {
        allButtons[i].ontouchend = joinGameHandler;
      }
    }
  }
}

async function openGamesList(): Promise<void> {
  swapScreens('start-screen', 'games-lobby');
  const games = await fetch(`${API_BASE}/games`, {
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

function closeLoseScreen(): void {
  swapScreens('lose-screen', 'start-screen');
}

function closeWinScreen(): void {
  swapScreens('win-screen', 'start-screen');
}

async function jumpToNewGame(): Promise<void> {
  if (!globalThis.socket.id) {
    await setTimeout(jumpToNewGame, 10);
    return;
  }
  return handleCreateGame().then(() => {
    handleStartGame();
  });
}

window.addEventListener('load', () => {
  const lazyImages = document.querySelectorAll('img.lazy');
  (lazyImages as NodeListOf<HTMLImageElement>).forEach((img: HTMLImageElement) => {
    img.src = img.dataset.src || '';

    img.classList.remove('lazy');
  });

  const gameElement = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (gameElement) {
    gameElement.onwheel = (event): void => {
      event.preventDefault();
    };

    initCanvasSize(gameElement);
    paper.setup(globalThis.gameElement);

    const createGameButton = document.getElementById('create-game');
    if (createGameButton) {
      createGameButton.ontouchend = handleCreateGame;
    }

    const openGamesListButton = document.getElementById('open-games-list');
    if (openGamesListButton) {
      openGamesListButton.ontouchend = openGamesList;
    }

    const gamesLobbyCancelButton = document.getElementById('games-lobby-cancel-button');
    if (gamesLobbyCancelButton) {
      gamesLobbyCancelButton.ontouchend = cancelGamesLobby;
    }

    const waitingRoomCancelButton = document.getElementById('waiting-room-cancel-button');
    if (waitingRoomCancelButton) {
      waitingRoomCancelButton.ontouchend = cancelWaitingRoom;
    }
    const loseScreenDonebutton = document.getElementById('lose-screen-done-button');
    if (loseScreenDonebutton) {
      loseScreenDonebutton.ontouchend = closeLoseScreen;
    }
    const winScreenDonebutton = document.getElementById('win-screen-done-button');
    if (winScreenDonebutton) {
      winScreenDonebutton.ontouchend = closeWinScreen;
    }

    globalThis.socket = io(SOCKET_BASE);
    globalThis.socket.on('connect', () => {
      const storedGameId = window.localStorage.getItem(LOCAL_STORAGE_GAME_ID);
      const storedPlayerId = window.localStorage.getItem(LOCAL_STORAGE_PLAYER_ID);
      if (storedGameId && storedPlayerId) {
        globalThis.socket.on(Messages.ReconnectFailed, () => {
          clearLocalStorage();
        });
        globalThis.socket.on(Messages.ReconnectSuccessful, (game: Game) => {
          populateGameGlobals(game.gameId, storedPlayerId);
          if (game.gameStatus === GameStatus.WaitingForPlayers) {
            goToWaitingRoom(game);
          }
          if (game.gameStatus === GameStatus.Ongoing) {
            swapScreens('start-screen', 'game-canvas');
            globalThis.clientGame = new ClientGame(game);
          }
        });
        globalThis.socket.emit(Messages.TryToReconnect, storedGameId, storedPlayerId);
      }
    });

    if (isDebug()) {
      clearLocalStorage();
    }
    if (isDebug('newGame')) {
      setTimeout(jumpToNewGame, 1);
    }
    if (isDebug('winScreen')) {
      setTimeout(() => {
        swapScreens('start-screen', 'win-screen');
        winGame();
      }, 1);
    }
    if (isDebug('loseScreen')) {
      setTimeout(() => {
        swapScreens('start-screen', 'lose-screen');
        loseGame();
      }, 1);
    }
  }
});
