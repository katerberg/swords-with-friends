import {Socket} from 'socket.io-client';

/*eslint-disable no-var*/
export {};

declare global {
  var gameElement: HTMLCanvasElement;
  var socket: Socket;
}
