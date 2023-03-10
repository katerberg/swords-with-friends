import * as ROT from 'rot-js';
import {Server, Socket} from 'socket.io';
import {AUTO_MOVE_DELAY} from '../types/consts';
import {coordsToNumberCoords} from '../types/math';
import {
  Cell,
  Coordinate,
  Game,
  GameStatus,
  GearItem,
  GearType,
  Item,
  ItemType,
  Messages,
  Monster,
  MonsterType,
  NumberCoordinates,
  Player,
  PlayerAction,
  PlayerActionName,
  PotionType,
  StatusEffectName,
  VisiblityStatus,
} from '../types/SharedTypes';
import {getRandomInt} from './data';
import {getMapLevel, isOnExitCell, isValidCoordinate, populateFov} from './dungeonMap';
import {
  createMonster,
  getClosestVisiblePlayerToMonster,
  getMonsterInCell,
  handleMonsterActionTowardsTarget,
  handleMonsterWander,
} from './monsters';
import {
  getFreePointAroundPoint,
  getGames,
  getRandomFreeLocation,
  getSpiralAroundPoint,
  getStartLocationNearHost,
} from '.';

function isFreeOfStandingPlayers(x: number, y: number, game: Game): boolean {
  return game.players.every((player) => player.currentHp <= 0 || player.x !== x || player.y !== y);
}

export function isFreeCell(x: number, y: number, game: Game, mapLevel?: number): boolean {
  const level = mapLevel !== undefined ? mapLevel : getMapLevel(game);
  return (
    isValidCoordinate(x, y) &&
    (!game.dungeonMap?.[level] ||
      game.dungeonMap[level].monsters.every((monster) => monster.x !== x || monster.y !== y)) &&
    isFreeOfStandingPlayers(x, y, game) &&
    (!game.dungeonMap?.[level] || game.dungeonMap[level].cells[`${x},${y}`].isPassable)
  );
}

function isPlayerPathableCell(x: number, y: number, game: Game): boolean {
  return (
    isValidCoordinate(x, y) &&
    game.dungeonMap[getMapLevel(game)].cells[`${x},${y}`].isPassable &&
    game.dungeonMap[getMapLevel(game)].cells[`${x},${y}`].visibilityStatus !== VisiblityStatus.Unseen
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

function killMonster(game: Game, mapLevel: number, monsterId: string): void {
  const monsterList = game.dungeonMap[mapLevel].monsters;
  const index = monsterList.findIndex((m) => m.monsterId === monsterId);
  if (index >= 0) {
    monsterList.splice(index, 1);
  }
}

function handlePlayerAttackMonster(game: Game, player: Player, monster: Monster): void {
  let damage: number;
  if (player.equipment) {
    damage = getRandomInt(player.equipment.minAttack, player.equipment.maxAttack);
  } else {
    damage = getRandomInt(player.minAttackStrength, player.maxAttackStrength);
  }

  monster.currentHp -= damage;
  if (monster.currentHp <= 0) {
    killMonster(game, player.mapLevel, monster.monsterId);
  } else if (monster.type === MonsterType.Slime) {
    const firstFree = getFreePointAroundPoint({x: monster.x, y: monster.y}, game, game.players[0].mapLevel);
    if (firstFree) {
      const newSlime = createMonster(`${firstFree.x},${firstFree.y}`, MonsterType.Slime);
      newSlime.currentHp = monster.currentHp;
      game.dungeonMap[player.mapLevel].monsters.push(newSlime);
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
  if (player.statusEffects.some((se) => se.name === StatusEffectName.Frozen || se.name === StatusEffectName.Pinned)) {
    return;
  }
  player.x = x;
  player.y = y;
  const cell = game.dungeonMap[player.mapLevel].cells[`${x},${y}`];
  playerPicksUpItems(cell, player);
}

function handlePlayerUsePotion(game: Game, player: Player, item: Item, targetX: number, targetY: number): void {
  const targetPlayer = game.players.find((p) => p.x === targetX && p.y === targetY);
  const targetMonster = game.dungeonMap[player.mapLevel].monsters.find((m) => m.x === targetX && m.y === targetY);
  const target = targetPlayer || targetMonster;
  switch (item.subtype) {
    case PotionType.Health:
      if (!target) {
        return;
      }
      target.currentHp = target.maxHp;
      break;
    case PotionType.Acid:
      if (!target) {
        return;
      }
      target.currentHp -= getRandomInt(25, 35);
      break;
    case PotionType.GoStone: {
      if (!target && isFreeCell(targetX, targetY, game, player.mapLevel)) {
        player.x = targetX;
        player.y = targetY;
        player.statusEffects.length = 0;
      }
      if (target) {
        target.x = player.x;
        target.y = player.y;
        if ((target as Player).playerId) {
          (target as Player).statusEffects.length = 0;
        }
        player.statusEffects.length = 0;
        player.x = targetX;
        player.y = targetY;
      }
      break;
    }
    case PotionType.Summon: {
      const spiral = getSpiralAroundPoint({x: targetX, y: targetY});
      game.players
        .filter((p) => p.playerId !== player.playerId)
        .forEach((p) => {
          let newCoords = spiral.shift();
          while (newCoords !== undefined) {
            if (newCoords && isFreeCell(newCoords.x, newCoords.y, game, p.mapLevel)) {
              p.x = newCoords.x;
              p.y = newCoords.y;
              p.currentAction = {name: PlayerActionName.Move, target: `${p.x},${p.y}`, path: []};
              newCoords = undefined;
            } else {
              newCoords = spiral.shift();
            }
          }
        });

      break;
    }
    case PotionType.Teleport: {
      if (!target) {
        return;
      }
      const {x, y} = getRandomFreeLocation(game, player.mapLevel);
      target.x = x;
      target.y = y;
      break;
    }
    default:
  }
}

function handlePlayerUseGear(game: Game, player: Player, item: GearItem, targetX: number, targetY: number): void {
  const targetPlayer = game.players.find((p) => p.x === targetX && p.y === targetY);
  switch (item.subtype) {
    case GearType.Sword:
      if (targetPlayer !== undefined) {
        if (targetPlayer.playerId !== player.playerId) {
          if (targetPlayer.equipment) {
            targetPlayer.items.push(item);
          } else {
            targetPlayer.equipment = item;
          }
        } else {
          if (targetPlayer.equipment) {
            targetPlayer.items.push(targetPlayer.equipment);
          }
          targetPlayer.equipment = item;
        }
        break;
      }
      game.dungeonMap[player.mapLevel].cells[`${targetX},${targetY}`].items.push(item);
      break;
    default:
  }
}

function handlePlayerUseItemAction(gameId: string, clientPlayer: Player): void {
  const game = getGames()[gameId];
  const gamePlayer = game.players.find((loopPlayer) => loopPlayer.playerId === clientPlayer.playerId);
  if (!gamePlayer || !gamePlayer.currentAction) {
    return;
  }
  const {currentAction} = gamePlayer;
  gamePlayer.currentAction = null;

  const {x: targetX, y: targetY} = coordsToNumberCoords(currentAction.target as Coordinate);
  const itemIndex = gamePlayer.items.findIndex((i) => i.itemId === currentAction.item);
  if (itemIndex === -1) {
    return;
  }
  const [item] = gamePlayer.items.splice(itemIndex, 1);
  switch (item.type) {
    case ItemType.Potion:
      handlePlayerUsePotion(game, gamePlayer, item, targetX, targetY);
      break;
    case ItemType.Gear:
      handlePlayerUseGear(game, gamePlayer, item as GearItem, targetX, targetY);
      break;
    default:
  }
}

function handlePlayerMovementAction(gameId: string, clientPlayer: Player): void {
  const game = getGames()[gameId];
  const gamePlayer = game.players.find((loopPlayer) => loopPlayer.playerId === clientPlayer.playerId);
  if (!gamePlayer || !gamePlayer.currentAction) {
    return;
  }
  const {x: targetX, y: targetY} = coordsToNumberCoords(gamePlayer.currentAction?.target as Coordinate);
  // Stop player from walking into a wall
  if (!isPlayerPathableCell(targetX, targetY, game)) {
    gamePlayer.currentAction = null;
    return;
  }
  // Next to goal
  if (Math.abs(targetX - gamePlayer.x) <= 1 && Math.abs(targetY - gamePlayer.y) <= 1) {
    const monster = getMonsterInCell(targetX, targetY, game);
    if (!monster && isFreeCell(targetX, targetY, game, gamePlayer.mapLevel)) {
      playerMovesTo(targetX, targetY, gamePlayer, game);
      if (isOnExitCell(gamePlayer, game)) {
        gamePlayer.currentAction = {name: PlayerActionName.WaitOnExit};
      } else {
        gamePlayer.currentAction = null;
      }
    } else if (monster) {
      handlePlayerAttackMonster(game, gamePlayer, monster);
      gamePlayer.currentAction = null;
    } else {
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
        handlePlayerAttackMonster(game, gamePlayer, monster);
      }
      gamePlayer.currentAction = null;
      return;
    }
    playerMovesTo(newX, newY, gamePlayer, game);
  } else {
    gamePlayer.currentAction = null;
  }
}

function executeQueuedActions(gameId: string, io: Server): void {
  const game = getGames()[gameId];
  const executionDate = new Date();
  game.lastActionTime = executionDate;
  game.players.forEach((player) => {
    if (!player.statusEffects.some((se) => se.name === StatusEffectName.Frozen)) {
      if (player.currentHp <= 0) {
        player.currentAction = {name: PlayerActionName.LayDead};
      }
      switch (player.currentAction?.name) {
        case PlayerActionName.LayDead:
          break;
        case PlayerActionName.UseItem:
          handlePlayerUseItemAction(gameId, player);
          break;
        case PlayerActionName.Move:
          handlePlayerMovementAction(gameId, player);
          break;
        case PlayerActionName.WaitOnExit:
          break;
        default:
          console.warn('invalid action', gameId, player.playerId); // eslint-disable-line no-console
      }
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
    const closestPlayer = getClosestVisiblePlayerToMonster(monster, game);
    if (closestPlayer) {
      monster.target = `${closestPlayer.x},${closestPlayer.y}`;
    } else if (monster.target && game.players.some((p) => p.currentHp <= 0 && `${p.x},${p.y}` === monster.target)) {
      monster.target = null;
    }
    if (monster.target) {
      handleMonsterActionTowardsTarget(monster, game);
    } else {
      handleMonsterWander(monster, game);
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
  const standingPlayers = game.players.filter((p) => p.currentHp > 0);
  if (standingPlayers.length > 0 && standingPlayers.every((p) => isOnExitCell(p, game))) {
    const host = game.players.find((p) => p.isHost);
    if (host) {
      host.mapLevel++;
      const spawn = coordsToNumberCoords(game.dungeonMap[host.mapLevel].playerSpawn);
      host.currentAction = null;
      host.x = spawn.x;
      host.y = spawn.y;
      game.players.forEach((p) => {
        if (!p.isHost) {
          p.mapLevel = host.mapLevel;
          const startLocation = getStartLocationNearHost(game);
          p.currentAction = null;
          p.x = startLocation.x;
          p.y = startLocation.y;
        }
        if (p.currentHp <= 0) {
          p.currentHp = 1;
        }
      });
    }
  }
}

function checkMonsterDeaths(game: Game): void {
  game.dungeonMap.forEach((level) => {
    level.monsters = level.monsters.filter((m) => m.currentHp > 0);
  });
}

function reduceCooldowns(game: Game): void {
  game.players.forEach((player) => {
    player.statusEffects = player.statusEffects
      .map((se) => ({...se, remainingTurns: se.remainingTurns - 1}))
      .filter((se) => se.remainingTurns > 0);
    if (player.statusEffects.some((se) => se.name === StatusEffectName.Frozen)) {
      player.currentAction = {name: PlayerActionName.Move, target: `${player.x},${player.y}`, path: []};
    }
  });
}

function checkTurnEnd(gameId: string, io: Server): void {
  const games = getGames();
  if (games[gameId]?.players.filter((p) => p.currentHp > 0).every((player) => player.currentAction !== null)) {
    const dungeonMap = games[gameId].dungeonMap[getMapLevel(games[gameId])];
    const previouslyVisibleMonsterIds = dungeonMap.monsters
      .filter((m) => dungeonMap.cells[`${m.x},${m.y}`].visibilityStatus === VisiblityStatus.Visible)
      .map((m) => m.monsterId);
    executeQueuedActions(gameId, io);
    checkMonsterDeaths(games[gameId]);
    executeMonsterActions(gameId);
    reduceCooldowns(games[gameId]);
    checkLevelEnd(gameId);
    populateFov(games[gameId]);
    const currentlyVisibleMonsters = dungeonMap.monsters.filter(
      (m) => dungeonMap.cells[`${m.x},${m.y}`].visibilityStatus === VisiblityStatus.Visible,
    );
    currentlyVisibleMonsters
      .filter((m) => !previouslyVisibleMonsterIds.includes(m.monsterId))
      .forEach((m) => {
        const player = getClosestVisiblePlayerToMonster(m, games[gameId]);
        if (player) {
          player.currentAction = null;
        }
      });

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
  socket.on(Messages.UseItem, (gameId: string, x: number, y: number, itemId: string) => {
    const games = getGames();
    const playerIndex = games[gameId]?.players.findIndex((player) => player.socketId === socket.id);
    if (
      playerIndex !== undefined &&
      games[gameId].players[playerIndex].currentHp > 0 &&
      isValidCoordinate(x, y) &&
      games[gameId].players[playerIndex].items.findIndex((item) => itemId === item.itemId) > -1
    ) {
      const action: PlayerAction = {
        name: PlayerActionName.UseItem,
        target: `${x},${y}`,
        item: itemId,
      };
      games[gameId].players[playerIndex].currentAction = action;
      io.emit(Messages.PlayerActionQueued, gameId, {
        action,
        playerId: games[gameId].players[playerIndex].playerId,
      });
      checkTurnEnd(gameId, io);
    }
  });

  socket.on(Messages.MovePlayer, (gameId: string, x: number, y: number) => {
    const games = getGames();
    const playerIndex = games[gameId]?.players.findIndex((player) => player.socketId === socket.id);
    if (playerIndex !== undefined && games[gameId].players[playerIndex]?.currentHp > 0 && isValidCoordinate(x, y)) {
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
