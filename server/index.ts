import * as http from 'http';
import {AddressInfo} from 'net';
import {Server} from 'socket.io';
import {v4 as uuid} from 'uuid';
import {Game, GamesHash, GameStatus, Messages, Player} from '../types/SharedTypes';
import {contrast, getRandomColor} from './color';
import {getRandomName} from './data';
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

function createPlayer(socketId: string, isHost = false): Player {
  const color = getRandomColor();
  return {
    playerId: uuid(),
    x: 10,
    y: 10,
    isHost,
    name: getRandomName(),
    socketId,
    maxHp: 10,
    currentHp: 10,
    color,
    textColor: contrast(color),
    currentAction: null,
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
      socket.broadcast.emit(Messages.GameStarted, gameId);
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
  const id = uuid();
  games[id] = {
    gameId: id,
    players: [createPlayer(req.query.socketId, true)],
    gameStatus: GameStatus.WaitingForPlayers,
    startTime: new Date(),
    turn: 0,
  };
  console.log('new game', id); //eslint-disable-line no-console
  io.emit(Messages.CurrentGames, getAvailableGames());
  res.send(games[id]);
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
  player.x = games[gameId].players[games[gameId].players.length - 1].x - 1;
  games[gameId].players.push(player);
  console.log('joined game', player.name, gameId); //eslint-disable-line no-console
  io.emit(Messages.PlayersChangedInGame, games[gameId]);
  res.send(games[gameId]);
});

// List players in a game
app.get('/api/games/:gameId/players', (req, res) => {
  const {gameId} = req.params;
  if (!games[gameId]) {
    return res.status(404).send({text: 'Game not found'});
  }
  if (!req.query.socketId || typeof req.query.socketId !== 'string') {
    return res.status(400).send({text: 'socketId is required'});
  }
  res.send(games[gameId].players);
});

// List available games
app.get('/api/games', (_req, res) => res.send(getAvailableGames()));
