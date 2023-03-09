import * as paper from 'paper';
import {X_VISIBLE_CELLS, Y_VISIBLE_CELLS} from '../types/consts';
import {
  GearType,
  Item,
  ItemType,
  Monster,
  MonsterType,
  NumberCoordinates,
  Player,
  PotionType,
} from '../types/SharedTypes';
import {getCellWidth} from './ClientGame';
import {BLACK, RED, WHITE} from './colors';

export function getBacking(color: string, center: paper.Point, width: number): paper.Shape.Rectangle {
  const rectTLPoint = new paper.Point(center);
  rectTLPoint.x -= width / 2 - 2;
  rectTLPoint.y -= width / 2 - 2;
  const rectBRPoint = new paper.Point(center);
  rectBRPoint.x += width / 2 - 2;
  rectBRPoint.y += width / 2 - 2;
  const playerBacking = new paper.Shape.Rectangle(rectTLPoint, rectBRPoint);
  playerBacking.strokeColor = new paper.Color(color);
  playerBacking.fillColor = new paper.Color(color);
  return playerBacking;
}

export function getHpBar(character: Player | Monster, center: paper.Point, width: number): paper.Shape.Rectangle {
  const padding = 2;
  const height = 6;
  const minX = center.x - width / 2 - padding;
  const maxX = center.x + width / 2 - padding;
  const maxWidth = maxX - minX;
  const barWidth = (maxWidth * character.currentHp) / character.maxHp;

  const rectTLPoint = new paper.Point(center);
  rectTLPoint.x -= width / 2 - padding;
  rectTLPoint.y += width / 2 - padding - height;
  const rectBRPoint = new paper.Point(center);
  rectBRPoint.x = minX + barWidth;
  rectBRPoint.y += width / 2 - padding;
  const hpBar = new paper.Shape.Rectangle(rectTLPoint, rectBRPoint);
  hpBar.strokeColor = RED;
  hpBar.fillColor = RED;
  return hpBar;
}

export function getMonster(monster: Monster, center: NumberCoordinates): paper.Group {
  let raster: paper.Raster;
  switch (monster.type) {
    case MonsterType.Goblin:
      raster = new paper.Raster('character-goblin');
      break;
    default:
      return new paper.Group();
  }
  const {x: coordX, y: coordY} = center;
  const circlePoint = new paper.Point(coordX, coordY);
  raster.position = circlePoint;
  const rasterScale = (getCellWidth() / raster.width) * 0.8;
  raster.scale(rasterScale);
  raster.shadowColor = WHITE;
  raster.shadowBlur = 42;

  const monsterGroup = new paper.Group([getBacking('#fff', circlePoint, rasterScale * raster.width), raster]);
  if (monster.currentHp < monster.maxHp) {
    monsterGroup.addChild(getHpBar(monster, circlePoint, raster.width * rasterScale));
  }
  return monsterGroup;
}

export function getRasterStringFromItems(items: Item[]): string {
  if (items.some((item) => item.type === ItemType.Trophy)) {
    return 'orb08';
  }
  if (items.some((item) => item.type === ItemType.Gear)) {
    if (items.some((item) => item.subtype === GearType.Sword)) {
      return 'sword33';
    }
  }
  if (items.some((item) => item.type === ItemType.Potion)) {
    if (items.some((item) => item.subtype === PotionType.Health)) {
      return 'gem91';
    }
    if (items.some((item) => item.subtype === PotionType.Acid)) {
      return 'gem95';
    }
    return 'gem11';
  }
  return '';
}

export function getInventoryItemSelectedMessage(): paper.Group {
  const cellWidth = getCellWidth();
  const title = new paper.PointText(new paper.Point((cellWidth * (X_VISIBLE_CELLS - 1.5)) / 2, cellWidth));
  title.content = 'Where?';
  title.strokeColor = BLACK;
  title.fontSize = 20;
  title.fontWeight = 800;
  title.shadowColor = WHITE;
  title.shadowBlur = 22;
  title.fillColor = WHITE;

  const padding = 3;
  const bl = new paper.Point(title.bounds.bottomLeft);
  bl.x -= padding;
  bl.y += padding;
  const tr = new paper.Point(title.bounds.topRight);
  tr.x += padding;
  tr.y -= padding;
  return new paper.Group([title]);
}

export function getFog(circlePoint: paper.Point): paper.Raster {
  const raster = new paper.Raster('fog');
  raster.position = circlePoint;
  const rasterScale = getCellWidth() / raster.width;
  raster.scale(rasterScale);
  return raster;
}

export function getCellOffsetFromMouseEvent(e: paper.MouseEvent): NumberCoordinates {
  const cellWidth = getCellWidth();
  const zeroBasedX = Math.floor(e.point.x / cellWidth);
  const zeroBasedY = Math.floor(e.point.y / cellWidth);
  const centerX = (X_VISIBLE_CELLS - 1) / 2;
  const centerY = (Y_VISIBLE_CELLS - 1) / 2;

  return {
    x: -1 * (zeroBasedX - centerX),
    y: -1 * (zeroBasedY - centerY),
  };
}
