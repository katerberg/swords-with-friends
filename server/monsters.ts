import * as ROT from 'rot-js';
import {v4 as uuid} from 'uuid';
import {calculateDistanceBetween, coordsToNumberCoords} from '../types/math';
import {Coordinate, Game, Monster, MonsterType, Player} from '../types/SharedTypes';
import {getRandomInt} from './data';
import {getMapLevel, isValidCoordinate} from './dungeonMap';
import {calculatePath} from './gameActions';

export function getPlayerInCell(x: number, y: number, game: Game): Player | null {
  return game.players.find((p) => p.x === x && p.y === y) || null;
}
export function getMonsterInCell(x: number, y: number, game: Game): Monster | null {
  return game.dungeonMap[getMapLevel(game)].monsters.find((monster) => monster.x === x && monster.y === y) || null;
}

function getLivingPlayersInViewOfMonster(monster: Monster, game: Game): Player[] {
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
    if (viewPlayer && viewPlayer.currentHp > 0) {
      playersInView.push(viewPlayer);
    }
  });
  return playersInView;
}

export function getClosestVisiblePlayerToMonster(monster: Monster, game: Game): Player | null {
  const playersInView = getLivingPlayersInViewOfMonster(monster, game);
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

export function handleMonsterWander(monster: Monster, game: Game): void {
  const availableLocations: Coordinate[] = [];
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      if (isMonsterPathableCell(monster.x + x, monster.y + y, game)) {
        availableLocations.push(`${monster.x + x},${monster.y + y}`);
      }
    }
  }
  if (availableLocations.length > 0) {
    const {x, y} = coordsToNumberCoords(availableLocations[Math.floor(Math.random() * availableLocations.length)]);
    monster.x = x;
    monster.y = y;
  }
}

function handleMonsterAttackPlayer(monster: Monster, player: Player): void {
  const damage = getRandomInt(monster.minAttackStrength, monster.maxAttackStrength);
  player.currentHp -= damage;
  if (monster.type === MonsterType.Vampire) {
    monster.currentHp += damage;
    if (monster.currentHp > monster.maxHp) {
      monster.currentHp = monster.maxHp;
    }
  }
  player.currentAction = null;
}

export function handleMonsterActionTowardsTarget(monster: Monster, game: Game): void {
  if (!monster.target) {
    return;
  }
  const {x, y} = coordsToNumberCoords(monster.target);
  const player = getPlayerInCell(x, y, game);
  if (player && Math.abs(x - monster.x) <= 1 && Math.abs(y - monster.y) <= 1) {
    handleMonsterAttackPlayer(monster, player);
  } else {
    const path = calculatePath(game, monster, x, y, isMonsterPathableCell);
    if (path.length > 0) {
      const {x: newX, y: newY} = coordsToNumberCoords(path[0]);
      monster.x = newX;
      monster.y = newY;
    }
  }
}

export function createMonster<Type extends MonsterType>(coordinate: Coordinate, type: Type): Monster {
  const {x, y} = coordsToNumberCoords(coordinate);
  let hp: number;
  let minAttack: number;
  let maxAttack: number;
  switch (type) {
    case MonsterType.Vampire:
      hp = 50;
      minAttack = 10;
      maxAttack = 15;
      break;
    case MonsterType.Orc:
      hp = 50;
      minAttack = 25;
      maxAttack = 45;
      break;
    case MonsterType.Goblin:
    default:
      hp = 20;
      minAttack = 15;
      maxAttack = 25;
      break;
  }

  return {
    x,
    y,
    type,
    minAttackStrength: minAttack,
    maxAttackStrength: maxAttack,
    maxHp: hp,
    currentHp: hp,
    monsterId: uuid(),
    target: null,
  };
}
