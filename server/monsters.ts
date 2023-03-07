import * as ROT from 'rot-js';
import {Coordinate, Game, Monster, NumberCoordinates, Player} from '../types/SharedTypes';
import {getMapLevel} from './dungeonMap';

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
    const viewPlayer = game.players.find((p) => p.x === x && p.y === y);
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
  let distance = 9999;
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
