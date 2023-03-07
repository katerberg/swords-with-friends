import * as http from 'http';
import {AddressInfo} from 'net';
import {Server} from 'socket.io';
import {v4 as uuid} from 'uuid';
import {MAX_X, MAX_Y} from '../types/consts';
import {coordsToNumberCoords} from '../types/math';
import {CharacterName, Game, GamesHash, GameStatus, Messages, NumberCoordinates, Player} from '../types/SharedTypes';
import {contrast, getRandomColor} from './color';
import {getRandomInt, getRandomName} from './data';
import {createMap} from './dungeonMap';
import {setup} from './express';
import {handleGameActions, isFreeCell} from './gameActions';

const app = setup();
const server = new http.Server(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:8080', 'http://0.0.0.0:8080', 'http://192.168.50.132:8080'],
    methods: ['GET', 'POST'],
  },
});

const games: GamesHash = {};

export function getGames(): GamesHash {
  return games;
}

function getAvailableGames(): Game[] {
  return Object.values(games).filter((game) => game.gameStatus === GameStatus.WaitingForPlayers);
}

function getRandomSpace(): NumberCoordinates {
  const x = getRandomInt(0, MAX_X - 1);
  const y = getRandomInt(0, MAX_Y - 1);
  return {x, y};
}

export function getRandomFreeLocation(game: Game): NumberCoordinates {
  const {x, y} = getRandomSpace();
  if (isFreeCell(x, y, game)) {
    return {x, y};
  }
  return getRandomFreeLocation(game);
}

function getSpiral(): NumberCoordinates[] {
  let x = 0;
  let y = 0;
  let delta = [0, -1];
  // spiral width
  const width = 6;
  // spiral height
  const height = 6;

  const points = [];
  for (let i = Math.pow(Math.max(width, height), 4); i > 0; i--) {
    if ((-1 * width) / 2 < x && x <= width / 2 && (-1 * height) / 2 < y && y <= height / 2) {
      points.push({x, y});
    }

    if (x === y || (x < 0 && x === -y) || (x > 0 && x === 1 - y)) {
      // change direction
      delta = [-delta[1], delta[0]];
    }

    x += delta[0];
    y += delta[1];
  }
  return points;
}
export function getSpiralAroundPoint({x, y}: NumberCoordinates): NumberCoordinates[] {
  return getSpiral().map(({x: spiralX, y: spiralY}) => ({x: x + spiralX, y: y + spiralY}));
}

export function getStartLocationNearHost(game: Game): NumberCoordinates {
  const {x, y} = game.players.find((p) => p.isHost) as Player;

  const firstFree = getSpiralAroundPoint({x, y}).find(({x: spiralX, y: spiralY}) => isFreeCell(spiralX, spiralY, game));
  return firstFree ? firstFree : getRandomFreeLocation(game);
}

function createPlayer(socketId: string, game: Game, isHost = false): Player {
  const color = getRandomColor();
  // const {x, y} = isHost ? coordsToNumberCoords(game.dungeonMap[0].playerSpawn) : getStartLocationNearHost(game);
  return {
    playerId: uuid(),
    x: 0,
    y: 0,
    isHost,
    character: CharacterName.SwordsWoman,
    name: getRandomName(),
    items: [],
    socketId,
    attackStrength: 5,
    maxHp: 10,
    currentHp: 10,
    color,
    textColor: contrast(color),
    currentAction: null,
    mapLevel: 0,
  };
}

io.on('connection', (socket) => {
  console.log('a user connected', socket.id); //eslint-disable-line no-console

  socket.on(Messages.LeaveGame, (gameId: string) => {
    const playerIndex = games[gameId]?.players.findIndex((player) => player.socketId === socket.id);
    if (playerIndex !== undefined) {
      console.log('removing player from ', gameId); //eslint-disable-line no-console
      if (games[gameId].players[playerIndex]?.isHost) {
        delete games[gameId];
        io.emit(Messages.GameClosed, gameId);
        io.emit(Messages.CurrentGames, getAvailableGames());
      } else {
        games[gameId].players.splice(playerIndex, 1);
        io.emit(Messages.PlayersChangedInGame, games[gameId]);
      }
    }
  });

  socket.on(Messages.ChangeName, (gameId: string, name: string) => {
    const playerIndex = games[gameId]?.players.findIndex((player) => player.socketId === socket.id);
    if (playerIndex !== undefined) {
      console.log('changing name for ', games[gameId].players[playerIndex].name, name); //eslint-disable-line no-console
      games[gameId].players[playerIndex].name = name;
      socket.broadcast.emit(Messages.NameChanged, gameId, games[gameId].players);
      socket.broadcast.emit(Messages.CurrentGames, getAvailableGames());
    }
  });

  socket.on(Messages.ChangeCharacter, (gameId: string, character: CharacterName) => {
    const playerIndex = games[gameId]?.players.findIndex((player) => player.socketId === socket.id);
    if (playerIndex !== undefined) {
      console.log('changing character for ', games[gameId].players[playerIndex].name, character); //eslint-disable-line no-console
      games[gameId].players[playerIndex].character = character;
      socket.broadcast.emit(Messages.CharacterChanged, gameId, games[gameId].players);
    }
  });

  socket.on(Messages.StartGame, (gameId: string) => {
    const playerIndex = games[gameId]?.players.findIndex((player) => player.socketId === socket.id);
    if (playerIndex !== undefined && games[gameId].players[playerIndex]?.isHost) {
      console.log('starting game', gameId); //eslint-disable-line no-console
      games[gameId].gameStatus = GameStatus.Ongoing;
      games[gameId].dungeonMap = createMap(games[gameId]);
      const {players} = games[gameId];
      const host = players.find((p) => p.isHost);
      if (host) {
        host.x = coordsToNumberCoords(games[gameId].dungeonMap[0].playerSpawn).x;
        host.y = coordsToNumberCoords(games[gameId].dungeonMap[0].playerSpawn).y;
        players.forEach((p) => {
          if (!p.isHost) {
            const {x, y} = getStartLocationNearHost(games[gameId]);
            p.x = x;
            p.y = y;
          }
        });
      } else {
        console.error('No host found in creation'); //eslint-disable-line no-console
      }
      io.emit(Messages.GameStarted, gameId, games[gameId]);
      socket.broadcast.emit(Messages.CurrentGames, getAvailableGames());
    }
  });
  handleGameActions(io, socket);
});

server.listen(8081, () => {
  const address = server.address() as AddressInfo;
  console.log(`Listening on ${address.port}`); //eslint-disable-line no-console
});

// Create a game
app.post('/api/games', (req, res) => {
  if (!req.query.socketId || typeof req.query.socketId !== 'string' || req.query.socketId === 'undefined') {
    return res.status(400).send({text: 'socketId is required'});
  }
  const gameId = uuid();
  games[gameId] = {
    gameId,
    players: [],
    gameStatus: GameStatus.WaitingForPlayers,
    startTime: new Date(),
    lastActionTime: new Date(),
    turn: 0,
    dungeonMap: [],
  };
  games[gameId].players.push(createPlayer(req.query.socketId, games[gameId], true));
  console.log('new game', gameId); //eslint-disable-line no-console
  io.emit(Messages.CurrentGames, getAvailableGames());
  res.send(games[gameId]);
  res.status(201).end();
});

// Join a game
app.post('/api/games/:gameId', (req, res) => {
  const {gameId} = req.params;
  if (!games[gameId]) {
    return res.status(404).send({text: 'Game not found'});
  }
  if (!req.query.socketId || typeof req.query.socketId !== 'string' || req.query.socketId === 'undefined') {
    return res.status(400).send({text: 'socketId is required'});
  }
  const player = createPlayer(req.query.socketId, games[gameId]);
  games[gameId].players.push(player);
  console.log('joined game', player.name, gameId); //eslint-disable-line no-console
  io.emit(Messages.PlayersChangedInGame, games[gameId]);
  res.send(games[gameId]);
});

// List available games
app.get('/api/games', (_req, res) => res.send(getAvailableGames()));
