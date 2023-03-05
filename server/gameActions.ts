import {Server, Socket} from 'socket.io';
import {MAX_X, MAX_Y} from '../types/consts';
import {Messages, PlayerAction} from '../types/SharedTypes';
import {getGames} from '.';

function isValidCoordinate(x: number, y: number): boolean {
  return x >= 0 && x <= MAX_X && y >= 0 && y <= MAX_Y;
}

function checkTurnEnd(gameId: string): void {
  const games = getGames();
  if (games[gameId]?.players.every((player) => player.currentAction !== null)) {
    console.log('all actions ready');
  }
}

export function handleGameActions(io: Server, socket: Socket): void {
  socket.on(Messages.MovePlayer, (gameId: string, x: number, y: number) => {
    const games = getGames();
    const playerIndex = games[gameId]?.players.findIndex((player) => player.socketId === socket.id);
    if (playerIndex !== undefined && isValidCoordinate(x, y)) {
      console.debug('moving player', x, y); //eslint-disable-line no-console
      const action: PlayerAction = {name: 'Move', target: `${x},${y}`};
      games[gameId].players[playerIndex].currentAction = action;
      io.emit(Messages.PlayerActionQueued, {gameId, action, playerId: games[gameId].players[playerIndex].playerId});
      checkTurnEnd(gameId);
      // games[gameId].players[playerIndex].x = x;
      // games[gameId].players[playerIndex].y = y;
      // io.emit(Messages.PlayerMoved, gameId, games[gameId].players[playerIndex]);
    }
  });
}
