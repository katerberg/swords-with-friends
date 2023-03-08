import {Coordinate, NumberCoordinates} from './SharedTypes';

export function coordsToNumberCoords(coords: Coordinate): NumberCoordinates {
  const [startX, startY] = coords.split(',');
  return {x: Number.parseInt(startX, 10), y: Number.parseInt(startY, 10)};
}

export function calculateDistanceBetween(coord1: NumberCoordinates, coord2: NumberCoordinates): number {
  const xDistance = Math.abs(coord1.x - coord2.x);
  const yDistance = Math.abs(coord1.y - coord2.y);

  return Math.sqrt(Math.pow(xDistance, 2) + Math.pow(yDistance, 2));
}
