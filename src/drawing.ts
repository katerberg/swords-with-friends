import * as paper from 'paper';

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
