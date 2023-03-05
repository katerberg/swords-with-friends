import {Socket} from 'socket.io-client';
import {Game} from './ClientGame';

/*eslint-disable no-var*/
export {};

declare global {
  var gameElement: HTMLCanvasElement;
  var currentGameId: string;
  var playerId: string;
  var game: Game;
  var socket: Socket;
}
