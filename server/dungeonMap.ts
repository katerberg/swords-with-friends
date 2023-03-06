import * as ROT from 'rot-js';
import {MAX_LEVEL, MAX_X, MAX_Y} from '../types/consts';
import {CellType, DungeonMap} from '../types/SharedTypes';

export function createMap(): DungeonMap {
  const dungeonMap: DungeonMap = [];

  const map = new ROT.Map.Digger(MAX_X, MAX_Y, {dugPercentage: 0.1, corridorLength: [0, 5]});

  for (let i = 0; i < MAX_LEVEL; i++) {
    dungeonMap[i] = {cells: {}, monsters: []};
    const mapCreationCallback = (x: number, y: number, value: number): void => {
      const type = value === 0 ? CellType.Earth : CellType.Wall;
      dungeonMap[i].cells[`${x},${y}`] = {
        x,
        y,
        type,
        isPassable: value === 0,
        isEntrance: false,
        isExit: false,
        isWalkable: value === 0,
      };
    };
    map._options.dugPercentage = (i + 1) * 0.2;
    map.create(mapCreationCallback);
    const rooms = map.getRooms();
    rooms.forEach((room) => {
      room.getDoors((doorx, doory) => {
        if (
          dungeonMap[i].cells[`${doorx - 1},${doory}`]?.type === CellType.Earth ||
          dungeonMap[i].cells[`${doorx + 1},${doory}`]?.type === CellType.Earth
        ) {
          dungeonMap[i].cells[`${doorx},${doory}`].type = CellType.HorizontalDoor;
        } else {
          dungeonMap[i].cells[`${doorx},${doory}`].type = CellType.VerticalDoor;
        }
      });
    });
  }
  return dungeonMap;
}
