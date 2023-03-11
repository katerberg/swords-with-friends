import {Coordinate, Monster, NumberCoordinates, Player} from './SharedTypes';

export function numberCoordsToCoords(numberCoords: NumberCoordinates): Coordinate {
  return `${numberCoords.x},${numberCoords.y}`;
}

export function coordsToNumberCoords(coords: Coordinate): NumberCoordinates {
  const [startX, startY] = coords.split(',');
  return {x: Number.parseInt(startX, 10), y: Number.parseInt(startY, 10)};
}

export function calculateDistanceBetween(coord1: NumberCoordinates, coord2: NumberCoordinates): number {
  const xDistance = Math.abs(coord1.x - coord2.x);
  const yDistance = Math.abs(coord1.y - coord2.y);

  return Math.sqrt(Math.pow(xDistance, 2) + Math.pow(yDistance, 2));
}

export function getCoordinatesForTarget(
  target: Monster | Player | Coordinate,
  players: Player[],
  monsters: Monster[],
): NumberCoordinates | null {
  if (typeof target === 'string') {
    return coordsToNumberCoords(target);
  }
  if ('playerId' in target) {
    const player = players.find((p) => p.playerId === target.playerId);
    if (player) {
      return {x: player.x, y: player.y};
    }
  }
  if ('monsterId' in target) {
    const monster = monsters.find((m) => m.monsterId === target.monsterId);
    if (monster) {
      return {x: monster.x, y: monster.y};
    }
  }

  return null;
}
