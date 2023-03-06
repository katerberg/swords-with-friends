import * as ROT from 'rot-js';
import {Server, Socket} from 'socket.io';
import {AUTO_MOVE_DELAY, MAX_X, MAX_Y} from '../types/consts';
import {coordsToNumberCoords} from '../types/math';
import {Coordinate, Game, Messages, Player, PlayerAction, PlayerActionName} from '../types/SharedTypes';
import {getGames} from '.';

function isValidCoordinate(x: number, y: number): boolean {
  return x >= 0 && x <= MAX_X && y >= 0 && y <= MAX_Y;
}

export function isFreeCell(x: number, y: number, game: Game): boolean {
  const mapLevel = game.players.length === 0 ? 0 : game.players[0].mapLevel;
  return (
    isValidCoordinate(x, y) &&
    game.players.every((player) => player.x !== x || player.y !== y) &&
    game.dungeonMap[mapLevel][`${x},${y}`].isPassable
  );
}

function calculatePath(game: Game, player: Player, targetX: number, targetY: number): Coordinate[] {
  //a star
  const aStar = new ROT.Path.AStar(
    targetX,
    targetY,
    (astarX: number, astarY: number): boolean =>
      (astarX === player.x && astarY === player.y) || isFreeCell(astarX, astarY, game),
  );
  const path: Coordinate[] = [];
  aStar.compute(player.x, player.y, (computeX, computeY) => {
    path.push(`${computeX},${computeY}`);
  });
  if (path.length > 0) {
    path.shift();
  }
  return path;
}

function handlePlayerMovementAction(gameId: string, player: Player): void {
  const {x, y} = coordsToNumberCoords(player.currentAction?.target as Coordinate);
  const game = getGames()[gameId];
  const gamePlayer = game.players.find((loopPlayer) => loopPlayer.playerId === player.playerId);
  if (gamePlayer) {
    if (!isFreeCell(x, y, game)) {
      gamePlayer.currentAction = null;
      return;
    }
    if (Math.abs(x - player.x) <= 1 && Math.abs(y - player.y) <= 1) {
      gamePlayer.x = x;
      gamePlayer.y = y;
      player.currentAction = null;
    } else if (gamePlayer.currentAction?.path?.length && gamePlayer.currentAction?.path?.length > 0) {
      const target = gamePlayer.currentAction.path.shift();
      if (!target) {
        gamePlayer.currentAction = null;
        return;
      }
      const {x: newX, y: newY} = coordsToNumberCoords(target);
      if (!isFreeCell(newX, newY, game)) {
        gamePlayer.currentAction = null;
        return;
      }
      gamePlayer.x = newX;
      gamePlayer.y = newY;
    } else {
      gamePlayer.currentAction = null;
    }
  }
}

function executeQueuedActions(gameId: string, io: Server): void {
  const game = getGames()[gameId];
  const executionDate = new Date();
  game.lastActionTime = executionDate;
  game.players.forEach((player) => {
    switch (player.currentAction?.name) {
      case PlayerActionName.Move:
        handlePlayerMovementAction(gameId, player);
        break;
      default:
        console.warn('invalid action', gameId, player.playerId); // eslint-disable-line no-console
    }
  });
  if (game.players.some((player) => player.currentAction)) {
    setTimeout(() => {
      if (game.lastActionTime === executionDate) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        checkTurnEnd(gameId, io);
      }
    }, AUTO_MOVE_DELAY);
  }
}

function checkTurnEnd(gameId: string, io: Server): void {
  const games = getGames();
  if (games[gameId]?.players.every((player) => player.currentAction !== null)) {
    executeQueuedActions(gameId, io);
    io.emit(Messages.TurnEnd, gameId, games[gameId]);
  }
}

export function handleGameActions(io: Server, socket: Socket): void {
  socket.on(Messages.MovePlayer, (gameId: string, x: number, y: number) => {
    const games = getGames();
    const playerIndex = games[gameId]?.players.findIndex((player) => player.socketId === socket.id);
    if (playerIndex !== undefined && isValidCoordinate(x, y)) {
      const action: PlayerAction = {
        name: PlayerActionName.Move,
        target: `${x},${y}`,
        path: calculatePath(games[gameId], games[gameId].players[playerIndex], x, y),
      };
      games[gameId].players[playerIndex].currentAction = action;
      console.log('emitting for', games[gameId].players[playerIndex].playerId);
      io.emit(Messages.PlayerActionQueued, gameId, {
        action,
        playerId: games[gameId].players[playerIndex].playerId,
      });
      checkTurnEnd(gameId, io);
    }
  });
}
