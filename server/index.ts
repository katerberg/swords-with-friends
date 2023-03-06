import * as http from 'http';
import {AddressInfo} from 'net';
import {Server} from 'socket.io';
import {v4 as uuid} from 'uuid';
import {MAX_X, MAX_Y} from '../types/consts';
import {Coordinate, Game, GamesHash, GameStatus, Messages, Player} from '../types/SharedTypes';
import {contrast, getRandomColor} from './color';
import {getRandomInt, getRandomName} from './data';
import {createMap} from './dungeonMap';
import {setup} from './express';
import {handleGameActions} from './gameActions';

const app = setup();
const server = new http.Server(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:8080', 'http://0.0.0.0:8080'],
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

function getRandomSpace(): Coordinate {
  const x = getRandomInt(0, MAX_X - 1);
  const y = getRandomInt(0, MAX_Y - 1);
  return `${x},${y}`;
}

function getStartingLocation(game: Game): {x: number; y: number} {
  const space = getRandomSpace();
  if (game.dungeonMap[0][space].isPassable) {
    const [x, y] = space.split(',');
    return {x: Number.parseInt(x, 10), y: Number.parseInt(y, 10)};
  }
  return getStartingLocation(game);
}

function createPlayer(socketId: string, game: Game, isHost = false): Player {
  const color = getRandomColor();
  const {x, y} = getStartingLocation(game);
  return {
    playerId: uuid(),
    x,
    y,
    isHost,
    name: getRandomName(),
    socketId,
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

  socket.on(Messages.StartGame, (gameId: string) => {
    const playerIndex = games[gameId]?.players.findIndex((player) => player.socketId === socket.id);
    if (playerIndex !== undefined && games[gameId].players[playerIndex]?.isHost) {
      console.log('starting game', gameId); //eslint-disable-line no-console
      games[gameId].gameStatus = GameStatus.Ongoing;
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
    turn: 0,
    dungeonMap: createMap(),
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
  player.x = games[gameId].players[games[gameId].players.length - 1].x - 1;
  games[gameId].players.push(player);
  console.log('joined game', player.name, gameId); //eslint-disable-line no-console
  io.emit(Messages.PlayersChangedInGame, games[gameId]);
  res.send(games[gameId]);
});

// List available games
app.get('/api/games', (_req, res) => res.send(getAvailableGames()));
