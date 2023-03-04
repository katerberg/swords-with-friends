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
  // socket.broadcast.emit('newPlayer', players[socket.id]);
  //   socket.on('disconnect', () => {
  //     console.log('user disconnected', socket.id); //eslint-disable-line no-console
  //     delete players[socket.id];
  //     // Emit a message to all players to remove this player
  //     io.emit('disconnect', socket.id);
  //   });

  socket.on('createGame', () => {
    const id = uuid();
    const player = {playerId: uuid(), x: 0, y: 0, isHost: true};
    games[id] = {gameId: id, players: [player], status: GameStatus.WaitingForPlayers};
    console.log('new game', player.playerId, id); //eslint-disable-line no-console
    socket.broadcast.emit('currentGames', games);
  });
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
