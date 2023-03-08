import * as ROT from 'rot-js';
import {Server, Socket} from 'socket.io';
import {AUTO_MOVE_DELAY} from '../types/consts';
import {coordsToNumberCoords} from '../types/math';
import {
  Cell,
  Coordinate,
  Game,
  GameStatus,
  ItemType,
  Messages,
  Monster,
  NumberCoordinates,
  Player,
  PlayerAction,
  PlayerActionName,
} from '../types/SharedTypes';
import {getMapLevel, isOnExitCell, isValidCoordinate, populateFov} from './dungeonMap';
import {getClosestPlayerToMonster, getMonsterInCell, handleMonsterActionTowardsTarget} from './monsters';
import {getGames, getStartLocationNearHost} from '.';

function isFreeOfStandingPlayers(x: number, y: number, game: Game): boolean {
  return game.players.every((player) => player.currentHp <= 0 || player.x !== x || player.y !== y);
}

export function isFreeCell(x: number, y: number, game: Game): boolean {
  const mapLevel = getMapLevel(game);
  return (
    isValidCoordinate(x, y) &&
    (!game.dungeonMap?.[mapLevel] ||
      game.dungeonMap[mapLevel].monsters.every((monster) => monster.x !== x || monster.y !== y)) &&
    isFreeOfStandingPlayers(x, y, game) &&
    (!game.dungeonMap?.[mapLevel] || game.dungeonMap[mapLevel].cells[`${x},${y}`].isPassable)
  );
}

function isPlayerPathableCell(x: number, y: number, game: Game): boolean {
  return (
    isValidCoordinate(x, y) &&
    isFreeOfStandingPlayers(x, y, game) &&
    game.dungeonMap[getMapLevel(game)].cells[`${x},${y}`].isPassable
  );
}

export function calculatePath(
  game: Game,
  actor: NumberCoordinates,
  targetX: number,
  targetY: number,
  pathableFunction: (x: number, y: number, game: Game) => boolean,
): Coordinate[] {
  //a star
  const aStar = new ROT.Path.AStar(
    targetX,
    targetY,
    (astarX: number, astarY: number): boolean =>
      (astarX === actor.x && astarY === actor.y) || pathableFunction(astarX, astarY, game),
  );
  const path: Coordinate[] = [];
  aStar.compute(actor.x, actor.y, (computeX, computeY) => {
    path.push(`${computeX},${computeY}`);
  });
  if (path.length > 0) {
    path.shift();
  }
  return path;
}

function handlePlayerAttack(game: Game, player: Player, monster: Monster): void {
  monster.currentHp -= player.attackStrength;
  if (monster.currentHp <= 0) {
    const monsterList = game.dungeonMap[player.mapLevel].monsters;
    const index = monsterList.findIndex((m) => m.monsterId === monster.monsterId);
    if (index >= 0) {
      monsterList.splice(index, 1);
    }
  }
}

function playerPicksUpItems(cell: Cell, player: Player): void {
  while (cell.items.length > 0) {
    const item = cell.items.pop();
    if (item) {
      player.items.push(item);
    }
  }
}

function playerMovesTo(x: number, y: number, player: Player, game: Game): void {
  player.x = x;
  player.y = y;
  const cell = game.dungeonMap[player.mapLevel].cells[`${x},${y}`];
  playerPicksUpItems(cell, player);
}

function handlePlayerMovementAction(gameId: string, clientPlayer: Player): void {
  const game = getGames()[gameId];
  const gamePlayer = game.players.find((loopPlayer) => loopPlayer.playerId === clientPlayer.playerId);
  if (gamePlayer) {
    const {x: targetX, y: targetY} = coordsToNumberCoords(gamePlayer.currentAction?.target as Coordinate);
    // Stop player from walking into other player
    if (!isPlayerPathableCell(targetX, targetY, game)) {
      gamePlayer.currentAction = null;
      return;
    }
    // Next to goal
    if (Math.abs(targetX - gamePlayer.x) <= 1 && Math.abs(targetY - gamePlayer.y) <= 1) {
      const monster = getMonsterInCell(targetX, targetY, game);
      if (!monster) {
        playerMovesTo(targetX, targetY, gamePlayer, game);
        if (isOnExitCell(gamePlayer, game)) {
          gamePlayer.currentAction = {name: PlayerActionName.WaitOnExit};
        } else {
          gamePlayer.currentAction = null;
        }
      } else {
        handlePlayerAttack(game, gamePlayer, monster);
        gamePlayer.currentAction = null;
      }
    } else if (gamePlayer.currentAction?.path?.length && gamePlayer.currentAction?.path?.length > 0) {
      const target = gamePlayer.currentAction.path.shift();
      // No next path step (shouldn't happen)
      if (!target) {
        gamePlayer.currentAction = null;
        return;
      }
      const {x: newX, y: newY} = coordsToNumberCoords(target);
      if (!isFreeCell(newX, newY, game)) {
        const monster = getMonsterInCell(newX, newY, game);
        if (monster) {
          handlePlayerAttack(game, gamePlayer, monster);
        }
        gamePlayer.currentAction = null;
        return;
      }
      playerMovesTo(newX, newY, gamePlayer, game);
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
      case PlayerActionName.LayDead:
        break;
      case PlayerActionName.Move:
        handlePlayerMovementAction(gameId, player);
        break;
      case PlayerActionName.WaitOnExit:
        break;
      default:
        console.warn('invalid action', gameId, player.playerId); // eslint-disable-line no-console
    }
  });
  if (game.players.some((player) => player.currentAction?.name !== PlayerActionName.LayDead)) {
    setTimeout(() => {
      if (game.lastActionTime === executionDate) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        checkTurnEnd(gameId, io);
      }
    }, AUTO_MOVE_DELAY);
  }
}

function executeMonsterActions(gameId: string): void {
  const game = getGames()[gameId];
  const mapLevel = getMapLevel(game);
  game.dungeonMap[mapLevel].monsters.forEach((monster) => {
    const closestPlayer = getClosestPlayerToMonster(monster, game);
    if (closestPlayer) {
      monster.target = `${closestPlayer.x},${closestPlayer.y}`;
    }
    if (monster.target) {
      handleMonsterActionTowardsTarget(monster, game);
    }
  });
}

function getGameStatus(gameId: string): GameStatus {
  const game = getGames()[gameId];
  game.players.forEach((p) => {
    if (p.currentHp <= 0) {
      p.currentAction = {name: PlayerActionName.LayDead};
    }
  });
  if (game.players.every((p) => p.currentHp <= 0)) {
    game.gameStatus = GameStatus.Lost;
  }
  if (game.players.some((p) => p.items.some((item) => item.type === ItemType.Trophy))) {
    game.gameStatus = GameStatus.Won;
  }
  return game.gameStatus;
}

function checkLevelEnd(gameId: string): void {
  const game = getGames()[gameId];
  if (game.players.every((p) => isOnExitCell(p, game))) {
    const host = game.players.find((p) => p.isHost);
    if (host) {
      host.mapLevel++;
      const spawn = coordsToNumberCoords(game.dungeonMap[host.mapLevel].playerSpawn);
      host.currentAction = null;
      host.x = spawn.x;
      host.y = spawn.y;
      game.players
        .filter((p) => !p.isHost)
        .forEach((p) => {
          p.mapLevel = host.mapLevel;
          const startLocation = getStartLocationNearHost(game);
          host.currentAction = null;
          p.x = startLocation.x;
          p.y = startLocation.y;
        });
    }
  }
}

function checkTurnEnd(gameId: string, io: Server): void {
  const games = getGames();
  if (games[gameId]?.players.every((player) => player.currentAction !== null)) {
    executeQueuedActions(gameId, io);
    executeMonsterActions(gameId);
    checkLevelEnd(gameId);
    populateFov(games[gameId]);
    const status = getGameStatus(gameId);
    if (status === GameStatus.Lost) {
      io.emit(Messages.GameLost, gameId, games[gameId]);
    } else if (status === GameStatus.Won) {
      io.emit(Messages.GameWon, gameId, games[gameId]);
    } else {
      io.emit(Messages.TurnEnd, gameId, games[gameId]);
    }
  }
}

export function handleGameActions(io: Server, socket: Socket): void {
  socket.on(Messages.MovePlayer, (gameId: string, x: number, y: number) => {
    const games = getGames();
    const playerIndex = games[gameId]?.players.findIndex((player) => player.socketId === socket.id);
    if (playerIndex !== undefined && games[gameId].players[playerIndex].currentHp > 0 && isValidCoordinate(x, y)) {
      const action: PlayerAction = {
        name: PlayerActionName.Move,
        target: `${x},${y}`,
        path: calculatePath(games[gameId], games[gameId].players[playerIndex], x, y, isPlayerPathableCell),
      };
      games[gameId].players[playerIndex].currentAction = action;
      io.emit(Messages.PlayerActionQueued, gameId, {
        action,
        playerId: games[gameId].players[playerIndex].playerId,
      });
      checkTurnEnd(gameId, io);
    }
  });
}
