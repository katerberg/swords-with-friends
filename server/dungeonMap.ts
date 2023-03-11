/* eslint-disable operator-linebreak */
/* eslint-disable multiline-ternary */
import * as ROT from 'rot-js';
import {v4 as uuid} from 'uuid';
import {MAX_LEVEL, MAX_X, MAX_Y} from '../types/consts';
import {calculateDistanceBetween, coordsToNumberCoords, numberCoordsToCoords} from '../types/math';
import {
  CellType,
  Coordinate,
  DungeonMap,
  Game,
  ItemType,
  PotionType,
  NumberCoordinates,
  Player,
  VisiblityStatus,
  TrophyType,
  MonsterType,
  PotionItem,
  GearType,
  GearItem,
} from '../types/SharedTypes';
import {getRandomInt, randomEnum} from './data';
import {isFreeCell} from './gameActions';
import {createMonster} from './monsters';
import {getRandomFreeLocation, getSpiralAroundPoint} from '.';
export function isValidCoordinate(x: number, y: number): boolean {
  return x >= 0 && x <= MAX_X && y >= 0 && y <= MAX_Y;
}

export function isOnExitCell(player: Player, game: Game): boolean {
  return game.dungeonMap[player.mapLevel].exits.some(
    (e) => coordsToNumberCoords(e).x === player.x && coordsToNumberCoords(e).y === player.y,
  );
}

export function getMapLevel(game: Game): number {
  return game.players.length === 0 ? 0 : game.players[0].mapLevel;
}

function getExits(centerPoint: NumberCoordinates, game: Game): Coordinate[] {
  const spacesAroundExit = getSpiralAroundPoint(centerPoint);
  const exits: Coordinate[] = [];
  let exitI = 0;
  while (exits.length < game.players.length) {
    if (exitI < spacesAroundExit.length) {
      if (isFreeCell(spacesAroundExit[exitI].x, spacesAroundExit[exitI].y, game)) {
        exits.push(numberCoordsToCoords(spacesAroundExit[exitI]));
      }
      exitI++;
    } else {
      const freeLocation = getRandomFreeLocation(game);
      exits.push(`${freeLocation.x},${freeLocation.y}`);
    }
  }
  return exits;
}

function updateFovCells(playerX: number, playerY: number, game: Game, mapLevel: number): void {
  function lightPasses(x: number, y: number): boolean {
    const key: Coordinate = `${x},${y}`;
    if (key in game.dungeonMap[mapLevel].cells) {
      return game.dungeonMap[mapLevel].cells[key].isPassable;
    }
    return false;
  }

  const viewLines = new ROT.FOV.PreciseShadowcasting(lightPasses);
  viewLines.compute(playerX, playerY, 10, (x, y) => {
    game.dungeonMap[mapLevel].cells[`${x},${y}`].visibilityStatus = VisiblityStatus.Visible;
  });
}

export function populateFov(game: Game): void {
  const mapLevel = getMapLevel(game);
  (Object.keys(game.dungeonMap[mapLevel].cells) as Coordinate[]).forEach((cellKey) => {
    if (game.dungeonMap[mapLevel].cells[cellKey].visibilityStatus === VisiblityStatus.Visible) {
      game.dungeonMap[mapLevel].cells[cellKey].visibilityStatus = VisiblityStatus.Seen;
    }
  });
  game.players.forEach((p) => {
    updateFovCells(p.x, p.y, game, mapLevel);
  });
}

export function getAttackStatsFromGear(type: GearType): {minAttack: number; maxAttack: number} {
  switch (type) {
    case GearType.SwordAngel:
      return {minAttack: 15, maxAttack: 30};
    case GearType.SwordVampire:
      return {minAttack: 15, maxAttack: 35};
    case GearType.SwordAcid:
      return {minAttack: 25, maxAttack: 35};
    case GearType.SwordBasic:
    default:
      return {minAttack: 15, maxAttack: 25};
  }
}

function getRandomGear(): GearItem {
  const randomGear = randomEnum(GearType);
  return {
    itemId: uuid(),
    type: ItemType.Gear,
    subtype: randomGear,
    ...getAttackStatsFromGear(randomGear),
  };
}

function getRandomPotion(game: Game): PotionItem {
  let randomPotion = randomEnum(PotionType);
  if (game.players.length === 1) {
    while (randomPotion === PotionType.Summon) {
      randomPotion = randomEnum(PotionType);
    }
  }
  return {
    itemId: uuid(),
    type: ItemType.Potion,
    subtype: randomPotion,
  };
}

export function spawnRandomPotion(x: number, y: number, game: Game): void {
  const mapLevel = getMapLevel(game);
  game.dungeonMap[mapLevel].cells[`${x},${y}`].items.push(getRandomPotion(game));
}

function getFreeSpaceCoords(game: Game, mapLevel: number): NumberCoordinates {
  let freeSpaceCoords: NumberCoordinates | null = null;
  while (freeSpaceCoords === null) {
    const freeLocation = getRandomFreeLocation(game, mapLevel);
    if (!game.players.some((p) => calculateDistanceBetween(freeLocation, p) < 4)) {
      freeSpaceCoords = freeLocation;
    }
  }
  return freeSpaceCoords;
}

export function populateItems(game: Game): void {
  game.dungeonMap.forEach((mapLevel, i) => {
    game.players.forEach(() => {
      for (let potionI = 0; potionI < 3; potionI++) {
        const freeSpaceCoords = getFreeSpaceCoords(game, i);
        mapLevel.cells[`${freeSpaceCoords.x},${freeSpaceCoords.y}`].items.push(getRandomPotion(game));
      }

      // 50% chance of sword per player per level
      if (Math.random() < 0.5) {
        const freeSpaceCoords = getFreeSpaceCoords(game, i);
        mapLevel.cells[`${freeSpaceCoords.x},${freeSpaceCoords.y}`].items.push(
          i === 0
            ? {
                itemId: uuid(),
                type: ItemType.Gear,
                subtype: GearType.SwordBasic,
                ...getAttackStatsFromGear(GearType.SwordBasic),
              }
            : getRandomGear(),
        );
      }
    });
  });
}

function populateMonsters(dungeonMap: DungeonMap, level: number, players: Player[]): void {
  const playerCount = players.length;
  let numberOfMonsters: number;
  let monsterOptions: MonsterType[];
  switch (level) {
    case 1:
      numberOfMonsters = 6 * playerCount + 2;
      monsterOptions = [MonsterType.Goblin, MonsterType.Tarball, MonsterType.Medusa];
      break;
    case 2:
      numberOfMonsters = 6 * playerCount + 3;
      monsterOptions = [MonsterType.Goblin, MonsterType.Tarball, MonsterType.Medusa, MonsterType.Slime];
      break;
    case 3:
      numberOfMonsters = 6 * playerCount + 3;
      monsterOptions = [MonsterType.Goblin, MonsterType.Medusa, MonsterType.Slime, MonsterType.Vampire];
      break;
    case 4:
      numberOfMonsters = 6 * playerCount + 3;
      monsterOptions = [MonsterType.Medusa, MonsterType.Slime, MonsterType.Vampire, MonsterType.Orc];
      break;
    default:
    case 0:
      numberOfMonsters = 5 * playerCount;
      monsterOptions = [MonsterType.Goblin, MonsterType.Tarball];
      break;
  }

  for (let i = 0; i < numberOfMonsters; i++) {
    const spiral = getSpiralAroundPoint(
      coordsToNumberCoords(dungeonMap[level].monsterSpawn[getRandomInt(0, dungeonMap[level].monsterSpawn.length - 1)]),
    );
    const [coords] = spiral.filter(
      ({x, y}) =>
        isValidCoordinate(x, y) &&
        (!dungeonMap[level] || dungeonMap[level].monsters.every((monster) => monster.x !== x || monster.y !== y)) &&
        players.every((player) => player.currentHp <= 0 || player.x !== x || player.y !== y) &&
        (!dungeonMap[level] || dungeonMap[level].cells[`${x},${y}`]?.isPassable),
    );

    if (coords) {
      dungeonMap[level].monsters.push(
        createMonster(`${coords.x},${coords.y}`, monsterOptions[getRandomInt(0, monsterOptions.length - 1)]),
      );
    }
  }
}

export function createMap(game: Game): DungeonMap {
  // TEST RANDOM
  // const blah: {[key: string]: number} = {};
  // for (let i = 0; i < 10000; i++) {
  //   const potion = randomEnum(MonsterType);
  //   blah[potion] = blah[potion] ? blah[potion] + 1 : 1;
  // }
  // console.log(blah);

  const dungeonMap: DungeonMap = [];

  const map = new ROT.Map.Digger(MAX_X, MAX_Y, {dugPercentage: 0.1, corridorLength: [0, 5]});

  for (let i = 0; i < MAX_LEVEL; i++) {
    dungeonMap[i] = {cells: {}, monsters: [], playerSpawn: '0,0', monsterSpawn: [], exits: []};
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
        visibilityStatus: VisiblityStatus.Unseen,
        items: [],
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

    const [exitX, exitY] = rooms[rooms.length - 1].getCenter();
    if (i !== MAX_LEVEL - 1) {
      getExits({x: exitX, y: exitY}, game).forEach((exit) => {
        dungeonMap[i].exits.push(exit);
        dungeonMap[i].cells[exit].type = CellType.Exit;
      });
    } else {
      dungeonMap[i].cells[`${exitX},${exitY}`].items.push({
        itemId: uuid(),
        type: ItemType.Trophy,
        subtype: TrophyType.Trophy,
      });
    }

    populateMonsters(dungeonMap, i, game.players);
  }
  return dungeonMap;
}
