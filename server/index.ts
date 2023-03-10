import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import {AddressInfo} from 'net';
import {Server} from 'socket.io';
import {v4 as uuid} from 'uuid';
import {MAX_X, MAX_Y} from '../types/consts';
import {coordsToNumberCoords} from '../types/math';
import {
  CharacterName,
  Game,
  GamesHash,
  GameStatus,
  GearType,
  ItemType,
  Messages,
  NumberCoordinates,
  Player,
  PotionType,
} from '../types/SharedTypes';
import {contrast, getRandomColor} from './color';
import {getRandomInt, getRandomName} from './data';
import {createMap, getAttackStatsFromGear, populateFov, populateItems} from './dungeonMap';
import {setup} from './express';
import {handleGameActions, isFreeCell} from './gameActions';

let server: http.Server | https.Server;
const app = setup();
if (process.env.ENV === 'development') {
  server = new http.Server(app);
} else {
  const httpsOptions = {
    key: fs.readFileSync(process.env.KEY || 'creds/fastify.key'),
    cert: fs.readFileSync(process.env.CERT || 'creds/fastify.crt'),
  };
  server = new https.Server(httpsOptions, app);
}

const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:8080',
      'http://0.0.0.0:8080',
      'http://192.168.50.132:8080',
      'http://swordswithfriends.org',
      'https://swordswithfriends.org',
      'http://localhost:9080',
      'http://0.0.0.0:9080',
      'http://192.168.50.132:9080',
    ],
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

export function getRandomFreeLocation(game: Game, mapLevel?: number): NumberCoordinates {
  const {x, y} = getRandomSpace();
  if (isFreeCell(x, y, game, mapLevel)) {
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

export function getFreePointAroundPoint(
  coords: NumberCoordinates,
  game: Game,
  mapLevel: number,
): NumberCoordinates | null {
  return getSpiralAroundPoint(coords).find((coord) => isFreeCell(coord.x, coord.y, game, mapLevel)) || null;
}

export function getStartLocationNearHost(game: Game): NumberCoordinates {
  const {x, y} = game.players.find((p) => p.isHost) as Player;

  const firstFree = getFreePointAroundPoint({x, y}, game, game.players[0].mapLevel);
  return firstFree ? firstFree : getRandomFreeLocation(game);
}

function createPlayer(socketId: string, isHost = false): Player {
  const color = getRandomColor();
  return {
    playerId: uuid(),
    x: 0,
    y: 0,
    isHost,
    character: CharacterName.SwordsWoman,
    name: getRandomName(),
    items: [{itemId: uuid(), type: ItemType.Potion, subtype: PotionType.Health}],
    equipment: {
      itemId: uuid(),
      type: ItemType.Gear,
      subtype: GearType.SwordAngel,
      ...getAttackStatsFromGear(GearType.SwordAngel),
    },
    socketId,
    minAttackStrength: 15,
    maxAttackStrength: 25,
    maxHp: 100,
    currentHp: 100,
    color,
    textColor: contrast(color),
    currentAction: null,
    mapLevel: 0,
    statusEffects: [],
  };
}

function findGame(socketId: string): Game | null {
  const foundGameId = Object.keys(games).find((gameId) => games[gameId].players.some((p) => p.socketId === socketId));
  return foundGameId ? games[foundGameId] : null;
}

function deleteOldGames(): void {
  const gamesToDelete: string[] = [];
  Object.keys(games).forEach((gameId) => {
    const game = games[gameId];
    const msSinceLastAction = new Date().getTime() - game.lastActionTime.getTime();
    // Old games where no one is around
    if (game.players.every((p) => p.socketId === null) && msSinceLastAction > 60_000) {
      gamesToDelete.push(gameId);
    }
    // Really old games
    if (msSinceLastAction > 3_600_000) {
      gamesToDelete.push(gameId);
    }
  });
  gamesToDelete.forEach((gid) => delete games[gid]);
}

io.on('connection', (socket) => {
  console.log('a user connected', socket.id); //eslint-disable-line no-console
  deleteOldGames();

  socket.on('disconnect', () => {
    const game = findGame(socket.id);
    if (game) {
      const player = game.players.find((p) => p.socketId === socket.id);
      if (player) {
        player.socketId = null;
      }
    }
  });

  socket.on(Messages.TryToReconnect, (gameId: string, playerId: string) => {
    const player = games[gameId]?.players.find((p) => p.socketId === null && p.playerId === playerId);
    if (player && [GameStatus.Ongoing, GameStatus.WaitingForPlayers].includes(games[gameId]?.gameStatus)) {
      console.debug('reconnecting', player.name, 'to', gameId); //eslint-disable-line no-console
      player.socketId = socket.id;
      socket.emit(Messages.ReconnectSuccessful, games[gameId]);
    } else {
      socket.emit(Messages.ReconnectFailed);
    }
  });

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
        populateItems(games[gameId]);
        populateFov(games[gameId]);
        io.emit(Messages.GameStarted, gameId, games[gameId]);
        socket.broadcast.emit(Messages.CurrentGames, getAvailableGames());
      } else {
        console.error('No host found in creation'); //eslint-disable-line no-console
      }
    }
  });
  handleGameActions(io, socket);
});

const args = process.argv.slice(2);
server.listen(args[0] || 8081, () => {
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
  const player = createPlayer(req.query.socketId, true);
  games[gameId].players.push(player);
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
  const player = createPlayer(req.query.socketId);
  games[gameId].players.push(player);
  console.log('joined game', player.name, gameId); //eslint-disable-line no-console
  io.emit(Messages.PlayersChangedInGame, games[gameId]);
  res.send(games[gameId]);
});

// List available games
app.get('/api/games', (_req, res) => res.send(getAvailableGames()));
