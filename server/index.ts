import * as http from 'http';
import {AddressInfo} from 'net';
import * as express from 'express';
import {Server} from 'socket.io';
import {v4 as uuid} from 'uuid';
import {Game, GameStatus} from '../types/SharedTypes';
import {getRandomName} from './data';

const app = express();
const server = new http.Server(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:8080', 'http://0.0.0.0:8080'],
    methods: ['GET', 'POST'],
  },
});

app.use(express.static(`${__dirname}/public`));

app.use((req, res, next) => {
  const allowedOrigins = ['http://localhost:8080', 'http://127.0.0.1:8080', 'http://0.0.0.0:8080'];
  const {origin} = req.headers;
  if (origin) {
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  }
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  return next();
});

app.get('/', (req, res) => {
  res.sendFile(`${__dirname}/index.html`);
});
type GamesHash = {[key: string]: Game};

const games: GamesHash = {};

io.on('connection', (socket) => {
  console.log('a user connected', socket.id); //eslint-disable-line no-console
  socket.on('changeName', (gameId, name) => {
    const playerIndex = games[gameId]?.players.findIndex((player) => player.socketId === socket.id);
    if (playerIndex !== undefined) {
      console.log('changing name for ', games[gameId].players[playerIndex].name, name); //eslint-disable-line no-console
      games[gameId].players[playerIndex].name = name;
      socket.broadcast.emit('nameChanged', gameId, games[gameId].players);
    }
  });
});

server.listen(8081, () => {
  const address = server.address() as AddressInfo;
  console.log(`Listening on ${address.port}`); //eslint-disable-line no-console
});

// Create a game
app.post('/api/games', (req, res) => {
  if (!req.query.socketId || typeof req.query.socketId !== 'string') {
    return res.status(400).send({text: 'socketId is required'});
  }
  const id = uuid();
  const player = {playerId: uuid(), x: 0, y: 0, isHost: true, name: getRandomName(), socketId: req.query.socketId};
  games[id] = {gameId: id, players: [player], status: GameStatus.WaitingForPlayers};
  console.log('new game', player.playerId, id); //eslint-disable-line no-console
  io.emit('currentGames', Object.values(games));
  res.send(games[id]);
  res.status(201).end();
});

// Join a game
app.post('/api/games/:gameId', (req, res) => {
  const {gameId} = req.params;
  if (!games[gameId]) {
    return res.status(404).send({text: 'Game not found'});
  }
  if (!req.query.socketId || typeof req.query.socketId !== 'string') {
    return res.status(400).send({text: 'socketId is required'});
  }
  const player = {playerId: uuid(), x: 0, y: 0, isHost: false, name: getRandomName(), socketId: req.query.socketId};
  games[gameId].players.push(player);
  console.log('joined game', player.playerId, gameId); //eslint-disable-line no-console
  io.emit('joinedGame', games[gameId]);
  res.send(games[gameId]);
});

// List games
app.get('/api/games', (_req, res) => res.send(Object.values(games)));
