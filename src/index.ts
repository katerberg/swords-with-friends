import './index.scss';
import * as paper from 'paper';
import {io} from 'socket.io-client';
import {BLACK} from './colors';

// screen.orientation?.lock('portrait');

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  socketId = new paper.PointText({
    point: paper.view.center.transform(new paper.Matrix().translate(0, 230)),
    justification: 'center',
    fontSize: 20,
    fillColor: BLACK,
    content: `Socket ID
    ${socket}`,
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

    globalThis.socket = io('http://localhost:8081');
    globalThis.socket.on('currentGames', (gamesList) => {
      drawSocketId(globalThis.socket.id);
      console.log('games', gamesList); //eslint-disable-line no-console
    });
    globalThis.socket.on('newPlayer', (playerList) => {
      console.log('new player', playerList); //eslint-disable-line no-console
    });
  }
});
