import {Socket} from 'socket.io-client';

/*eslint-disable no-var*/
export {};

declare global {
  var gameElement: HTMLCanvasElement;
  var currentGameId: string;
  var socket: Socket;
  var playerId: string;
}
