import * as ROT from 'rot-js';
import {MAX_X, MAX_Y} from '../types/consts';
import {CellType, DungeonMap} from '../types/SharedTypes';

export function createMap(): DungeonMap {
  const dungeonMap: DungeonMap = [];

  const map = new ROT.Map.Digger(MAX_X, MAX_Y, {dugPercentage: 0.1, corridorLength: [0, 5]});

  for (let i = 0; i < 4; i++) {
    dungeonMap[i] = {};
    const mapCreationCallback = (x: number, y: number, value: number): void => {
      dungeonMap[i][`${x},${y}`] = {
        x,
        y,
        type: value === 0 ? CellType.Earth : CellType.Wall,
        isPassable: value === 0,
        isEntrance: false,
        isExit: false,
        isWalkable: value === 0,
      };
    };
    map._options.dugPercentage = i * 0.1;
    map.create(mapCreationCallback);
  }
  return dungeonMap;
}
