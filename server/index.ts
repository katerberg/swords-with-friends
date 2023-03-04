import * as http from 'http';
import {AddressInfo} from 'net';
import * as express from 'express';
import {Server} from 'socket.io';
import {v4 as uuid} from 'uuid';

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
type GamesHash = {[key: string]: Game};

const games: GamesHash = {};

// function calculateRandomX(): number {
//   return Math.floor(Math.random() * 988) + 200;
// }

// function calculateRandomY(): number {
//   return Math.floor(Math.random() * 550) + 40;
// }

io.on('connection', (socket) => {
  console.log('a user connected', socket.id); //eslint-disable-line no-console
  // // Update all other players of the new player

  // socket.on('projectileFiring', (serverProjectile) => {
  //   if (players[socket.id]) {
  //     socket.broadcast.emit('projectileFired', {
  //       ...serverProjectile,
  //       playerId: socket.id,
  //     });
  //   }
  // });
});

server.listen(8081, () => {
  const address = server.address() as AddressInfo;
  console.log(`Listening on ${address.port}`); //eslint-disable-line no-console
});

app.post('/api/games', (req, res) => {
  const id = uuid();
  const player = {playerId: uuid(), x: 0, y: 0, isHost: true};
  games[id] = {gameId: id, players: [player], status: GameStatus.WaitingForPlayers};
  console.log('new game', player.playerId, id); //eslint-disable-line no-console
  io.emit('currentGames', Object.values(games));
  res.send('null');
  res.status(201).end();
});

app.get('/api/games', (_req, res) => res.send(Object.values(games)));
