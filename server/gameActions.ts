import * as ROT from 'rot-js';
import {Server, Socket} from 'socket.io';
import {AUTO_MOVE_DELAY, MAX_X, MAX_Y} from '../types/consts';
import {Game, Messages, NumberCoordinates, Player, PlayerAction, PlayerActionName} from '../types/SharedTypes';
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

function handlePlayerMovementAction(gameId: string, player: Player): void {
  const [x, y] = (player.currentAction?.target as string).split(',');
  const targetX = Number.parseInt(x, 10);
  const targetY = Number.parseInt(y, 10);
  const game = getGames()[gameId];
  if (isFreeCell(targetX, targetY, game)) {
    const gamePlayer = game.players.find((loopPlayer) => loopPlayer.playerId === player.playerId);
    if (gamePlayer) {
      if (Math.abs(targetX - player.x) <= 1 && Math.abs(targetY - player.y) <= 1) {
        gamePlayer.x = targetX;
        gamePlayer.y = targetY;
        player.currentAction = null;
      } else {
        //a star
        const aStar = new ROT.Path.AStar(
          targetX,
          targetY,
          (astarX: number, astarY: number): boolean =>
            (astarX === gamePlayer.x && astarY === gamePlayer.y) || isFreeCell(astarX, astarY, game),
        );
        const path: NumberCoordinates[] = [];
        aStar.compute(gamePlayer.x, gamePlayer.y, (computeX, computeY) => {
          path.push({x: computeX, y: computeY});
        });
        if (path.length > 1) {
          gamePlayer.x = path[1].x;
          gamePlayer.y = path[1].y;
        } else {
          player.currentAction = null;
        }
      }
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
      const action: PlayerAction = {name: PlayerActionName.Move, target: `${x},${y}`};
      games[gameId].players[playerIndex].currentAction = action;
      io.emit(Messages.PlayerActionQueued, gameId, {
        action,
        playerId: games[gameId].players[playerIndex].playerId,
      });
      checkTurnEnd(gameId, io);
    }
  });
}
