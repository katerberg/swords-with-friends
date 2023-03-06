import * as ROT from 'rot-js';
import {v4 as uuid} from 'uuid';
import {MAX_LEVEL, MAX_X, MAX_Y} from '../types/consts';
import {coordsToNumberCoords} from '../types/math';
import {CellType, Coordinate, DungeonMap, Monster, MonsterType} from '../types/SharedTypes';

function createMonster(coordinate: Coordinate): Monster {
  const {x, y} = coordsToNumberCoords(coordinate);
  return {x, y, type: MonsterType.Goblin, attackStrength: 1, maxHp: 5, currentHp: 5, monsterId: uuid()};
}

export function createMap(): DungeonMap {
  const dungeonMap: DungeonMap = [];

  const map = new ROT.Map.Digger(MAX_X, MAX_Y, {dugPercentage: 0.1, corridorLength: [0, 5]});

  for (let i = 0; i < MAX_LEVEL; i++) {
    dungeonMap[i] = {cells: {}, monsters: [], playerSpawn: '0,0', monsterSpawn: []};
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
    rooms.forEach((room, roomI) => {
      const [centerX, centerY] = room.getCenter();
      if (roomI === 0) {
        dungeonMap[i].playerSpawn = `${centerX},${centerY}`;
      } else {
        dungeonMap[i].monsterSpawn.push(`${centerX},${centerY}`);
      }

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
    dungeonMap[i].monsterSpawn.forEach((ms) => {
      dungeonMap[i].monsters.push(createMonster(ms));
    });
  }
  return dungeonMap;
}
