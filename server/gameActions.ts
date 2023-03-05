import {Server, Socket} from 'socket.io';
import {MAX_X, MAX_Y} from '../types/consts';
import {GamesHash, Messages} from '../types/SharedTypes';

function isValidCoordinate(x: number, y: number): boolean {
  return x >= 0 && x <= MAX_X && y >= 0 && y <= MAX_Y;
}

export function handleGameActions(io: Server, socket: Socket, games: GamesHash): void {
  socket.on(Messages.MovePlayer, (gameId: string, x: number, y: number) => {
    const playerIndex = games[gameId]?.players.findIndex((player) => player.socketId === socket.id);
    if (playerIndex !== undefined && isValidCoordinate(x, y)) {
      console.debug('moving player', x, y); //eslint-disable-line no-console
      games[gameId].players[playerIndex].x = x;
      games[gameId].players[playerIndex].y = y;
      io.emit(Messages.PlayerMoved, gameId, games[gameId].players[playerIndex]);
    }
  });
}
