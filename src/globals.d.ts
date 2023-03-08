import {Socket} from 'socket.io-client';
import {ClientGame} from './ClientGame';

/*eslint-disable no-var*/
export {};

declare global {
  var gameElement: HTMLCanvasElement;
  var currentGameId: string;
  var playerId: string;
  var socket: Socket;
  var clientGame: ClientGame;
}
