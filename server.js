const express = require('express');
const app = express();
const server = require('http').Server(app);
const uuid = require('uuid').v4;
const {Server} = require('socket.io');
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

const players = {};

function calculateRandomX() {
  return Math.floor(Math.random() * 988) + 200;
}

function calculateRandomY() {
  return Math.floor(Math.random() * 550) + 40;
}

io.on('connection', (socket) => {
  console.log('a user connected', socket.id); //eslint-disable-line no-console
  // Create a new player and add it to our players object
  players[socket.id] = {
    angle: 0,
    x: calculateRandomX(),
    y: calculateRandomY(),
    playerId: socket.id,
  };
  // Send the players object to the new player
  socket.emit('currentPlayers', players);
  // Update all other players of the new player
  socket.broadcast.emit('newPlayer', players[socket.id]);
  //   socket.on('disconnect', () => {
  //     console.log('user disconnected', socket.id); //eslint-disable-line no-console
  //     delete players[socket.id];
  //     // Emit a message to all players to remove this player
  //     io.emit('disconnect', socket.id);
  //   });

  socket.on('projectileFiring', (serverProjectile) => {
    if (players[socket.id]) {
      socket.broadcast.emit('projectileFired', {
        ...serverProjectile,
        playerId: socket.id,
      });
    }
  });
});

server.listen(8081, () => {
  console.log(`Listening on ${server.address().port}`); //eslint-disable-line no-console
});
