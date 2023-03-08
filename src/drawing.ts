import * as paper from 'paper';
import {Monster, MonsterType, NumberCoordinates, Player} from '../types/SharedTypes';
import {getCellWidth} from './ClientGame';
import {RED, WHITE} from './colors';

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

export function getFog(circlePoint: paper.Point): paper.Raster {
  const raster = new paper.Raster('fog');
  raster.position = circlePoint;
  const rasterScale = getCellWidth() / raster.width;
  raster.scale(rasterScale);
  return raster;
}
