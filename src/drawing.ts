import * as paper from 'paper';
import {Player} from '../types/SharedTypes';
import {RED} from './colors';

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

export function getHpBar(player: Player, center: paper.Point, width: number): paper.Shape.Rectangle {
  const padding = 2;
  const height = 6;
  const minX = center.x - width / 2 - padding;
  const maxX = center.x + width / 2 - padding;
  const maxWidth = maxX - minX;
  const barWidth = (maxWidth * player.currentHp) / player.maxHp;

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
