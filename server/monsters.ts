import * as ROT from 'rot-js';
import {coordsToNumberCoords} from '../types/math';
import {Coordinate, Game, Monster, NumberCoordinates, Player} from '../types/SharedTypes';
import {getMapLevel, isValidCoordinate} from './dungeonMap';
import {calculatePath} from './gameActions';

export function getPlayerInCell(x: number, y: number, game: Game): Player | null {
  return game.players.find((p) => p.x === x && p.y === y) || null;
}
export function getMonsterInCell(x: number, y: number, game: Game): Monster | null {
  return game.dungeonMap[getMapLevel(game)].monsters.find((monster) => monster.x === x && monster.y === y) || null;
}

function getPlayersInViewOfMonster(monster: Monster, game: Game): Player[] {
  const mapLevel = getMapLevel(game);

  function lightPasses(x: number, y: number): boolean {
    const key: Coordinate = `${x},${y}`;
    if (key in game.dungeonMap[mapLevel].cells) {
      return game.dungeonMap[mapLevel].cells[key].isPassable;
    }
    return false;
  }

  const viewLines = new ROT.FOV.PreciseShadowcasting(lightPasses);

  const playersInView: Player[] = [];

  viewLines.compute(monster.x, monster.y, 10, (x, y) => {
    const viewPlayer = getPlayerInCell(x, y, game);
    if (viewPlayer) {
      playersInView.push(viewPlayer);
    }
  });
  return playersInView;
}

function calculateDistanceBetween(coord1: NumberCoordinates, coord2: NumberCoordinates): number {
  const xDistance = Math.abs(coord1.x - coord2.x);
  const yDistance = Math.abs(coord1.y - coord2.y);

  return Math.sqrt(Math.pow(xDistance, 2) + Math.pow(yDistance, 2));
}

export function getClosestPlayerToMonster(monster: Monster, game: Game): Player | null {
  const playersInView = getPlayersInViewOfMonster(monster, game);
  if (playersInView.length === 0) {
    return null;
  } else if (playersInView.length === 1) {
    return playersInView[0];
  }
  let [player] = playersInView;
  let distance = calculateDistanceBetween(monster, player);
  playersInView.forEach((p, i) => {
    if (i !== 0) {
      const testDistance = calculateDistanceBetween(monster, p);
      if (testDistance < distance) {
        player = p;
        distance = testDistance;
      }
    }
  });
  return player;
}

function isMonsterPathableCell(x: number, y: number, game: Game): boolean {
  const mapLevel = getMapLevel(game);
  return (
    isValidCoordinate(x, y) &&
    game.dungeonMap[mapLevel].monsters.every((monster) => monster.x !== x || monster.y !== y) &&
    game.dungeonMap[mapLevel].cells[`${x},${y}`].isPassable
  );
}

export function handleMonsterActionTowardsTarget(monster: Monster, game: Game): void {
  if (!monster.target) {
    return;
  }
  const {x, y} = coordsToNumberCoords(monster.target);
  const player = getPlayerInCell(x, y, game);
  if (player && Math.abs(x - monster.x) <= 1 && Math.abs(y - monster.y) <= 1) {
    player.currentHp -= monster.attackStrength;
  } else {
    const path = calculatePath(game, monster, x, y, isMonsterPathableCell);
    if (path.length > 0) {
      const {x: newX, y: newY} = coordsToNumberCoords(path[0]);
      monster.x = newX;
      monster.y = newY;
    }
  }
}
