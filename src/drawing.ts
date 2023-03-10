import * as paper from 'paper';
import {X_VISIBLE_CELLS, Y_VISIBLE_CELLS} from '../types/consts';
import {
  CharacterName,
  GearType,
  Item,
  ItemType,
  Monster,
  MonsterType,
  NumberCoordinates,
  Player,
  PotionType,
  StatusEffectName,
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

export function getRemainingTurnsBadge(player: Player, center: paper.Point, width: number): paper.Group {
  const statusEffect =
    player.statusEffects.find((se) => se.name === StatusEffectName.Frozen) ||
    player.statusEffects.find((se) => se.name === StatusEffectName.Pinned);
  const turns = statusEffect?.remainingTurns || 0;
  const circleRadius = 5;
  const circleCenter = {x: center.x + width / 2 - circleRadius, y: center.y - width / 2 + circleRadius};
  const text = new paper.PointText({...circleCenter, y: circleCenter.y + 3});
  text.fontSize = 10;
  text.content = `${turns}`;
  text.fillColor = new paper.Color(player.textColor);
  text.justification = 'center';
  const backing = new paper.Shape.Circle(circleCenter, circleRadius);
  backing.fillColor = new paper.Color(player.color);

  return new paper.Group([backing, text]);
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
    case MonsterType.Medusa:
      raster = new paper.Raster('character-medusa');
      break;
    case MonsterType.Tarball:
      raster = new paper.Raster('character-tarball');
      break;
    case MonsterType.Slime:
      raster = new paper.Raster('character-slime');
      break;
    case MonsterType.Vampire:
      raster = new paper.Raster('character-vampire');
      break;
    case MonsterType.Goblin:
      raster = new paper.Raster('character-goblin');
      break;
    case MonsterType.Orc:
      raster = new paper.Raster('character-orc');
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
    if (items.some((item) => item.subtype === PotionType.Teleport)) {
      return 'gem29';
    }
    if (items.some((item) => item.subtype === PotionType.Health)) {
      return 'gem91';
    }
    if (items.some((item) => item.subtype === PotionType.GoStone)) {
      return 'gem49';
    }
    if (items.some((item) => item.subtype === PotionType.Summon)) {
      return 'gem43';
    }
    if (items.some((item) => item.subtype === PotionType.Acid)) {
      return 'gem95';
    }
    return 'gem11';
  }
  return '';
}

export function getRasterStringForPlayer(player: Player): string {
  if (player.currentHp <= 0) {
    return CharacterName.Dead;
  }
  if (player.statusEffects.some((se) => se.name === StatusEffectName.Frozen)) {
    return CharacterName.Frozen;
  }
  if (player.statusEffects.some((se) => se.name === StatusEffectName.Pinned)) {
    return CharacterName.Pinned;
  }
  return player.character;
}

export function getMessage(content: string): paper.Group {
  const cellWidth = getCellWidth();
  const title = new paper.PointText(new paper.Point((cellWidth * (X_VISIBLE_CELLS - 1.5)) / 2, cellWidth));
  title.content = content;
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
