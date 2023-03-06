/* eslint-disable no-case-declarations */
import * as paper from 'paper';
import {coordsToNumberCoords} from '../types/math';
import {
  Cell,
  CellType,
  Coordinate,
  DungeonMap,
  Game,
  Messages,
  NumberCoordinates,
  Player,
  PlayerAction,
  PlayerActionName,
} from '../types/SharedTypes';
import {BLACK} from './colors';

const xVisibleCells = 7;
const yVisibleCells = 11;
const cellPadding = 0;
const badgePadding = 6;

function getCellWidth(): number {
  const {width} = globalThis.gameElement.getBoundingClientRect();
  return (width - cellPadding * 2 * xVisibleCells) / xVisibleCells;
}

export class ClientGame {
  dungeonMap: DungeonMap;

  level: number;

  drawnTiles: {[key: Coordinate]: paper.Group};

  drawnMap: {[key: Coordinate]: paper.Group};

  drawnMovementPaths: {[playerId: string]: paper.Group};

  players: Player[];

  playerBadges: paper.Group[];

  constructor(game: Game) {
    this.players = game.players;
    const {height, width} = globalThis.gameElement.getBoundingClientRect();
    const cellWidth = getCellWidth();

    this.playerBadges = game.players.map((player, i) => {
      const circlePoint = new paper.Point(width - cellWidth, height - cellWidth - i * cellWidth - badgePadding * i);
      const circle = new paper.Shape.Circle(circlePoint, cellWidth / 2);
      circle.strokeWidth = 3;
      circle.shadowColor = BLACK;
      circle.shadowBlur = 12;
      circle.fillColor = new paper.Color(player.color);
      circle.strokeColor = BLACK;
      const text = new paper.PointText({
        point: circlePoint,
        justification: 'center',
        fontSize: 20,
        fillColor: new paper.Color(player.textColor),
        content: '...',
      });
      return new paper.Group([circle, text]);
    });

    this.drawnMap = {};
    this.drawnMovementPaths = {};
    this.drawnTiles = {};
    this.level = 0;
    this.dungeonMap = game.dungeonMap;

    globalThis.socket.on(Messages.TurnEnd, this.handleTurnEnd.bind(this));
    globalThis.socket.on(Messages.PlayerActionQueued, this.handlePlayerActionQueue.bind(this));
    this.drawMap();
  }

  private get currentPlayer(): Player {
    return this.players.find((player) => player.playerId === globalThis.playerId) as Player;
  }

  private resetAllBadgeContent(): void {
    this.playerBadges.forEach((badgeGroup, i) => {
      const text = badgeGroup.lastChild as paper.PointText;
      if (this.players[i].currentAction === null) {
        text.content = '...';
      }
    });
  }

  private setBadgeContent(playerId: string, content: string): void {
    const index = this.players.findIndex((player) => playerId === player.playerId);
    if (index === -1) {
      return;
    }
    const text = this.playerBadges[index].lastChild as paper.PointText;
    text.content = content;
  }

  private handlePlayerActionQueue(gameId: string, actionQueued: {action: PlayerAction; playerId: string}): void {
    if (gameId !== globalThis.currentGameId) {
      return;
    }
    const player = this.players.find((p) => p.playerId === actionQueued.playerId);
    if (player) {
      player.currentAction = actionQueued.action;
      if (actionQueued.action.name === PlayerActionName.Move) {
        this.drawMap();
      }
    }
    this.setBadgeContent(actionQueued.playerId, '✓');
  }

  private handleTurnEnd(gameId: string, game: Game): void {
    if (gameId !== globalThis.currentGameId) {
      return;
    }

    this.players.forEach((thisPlayer) => {
      const updatedPlayer = game.players.find((gamePlayer) => gamePlayer.playerId === thisPlayer.playerId) as Player;
      thisPlayer.x = updatedPlayer.x;
      thisPlayer.y = updatedPlayer.y;
      thisPlayer.currentAction = updatedPlayer.currentAction;
    });
    this.resetAllBadgeContent();
    this.drawMap();
  }

  private handleCellClick(xOffset: number, yOffset: number): void {
    const x = this.currentPlayer.x + xOffset;
    const y = this.currentPlayer.y + yOffset;
    if (this.players.find((player) => player.x === x && player.y === y)) {
      return;
    }
    if (!this.dungeonMap[this.level].cells[`${x},${y}`].isPassable) {
      return;
    }

    globalThis.socket.emit(Messages.MovePlayer, globalThis.currentGameId, x, y);
  }

  private getCellCenterPointFromCoordinates(coordinates: Coordinate): NumberCoordinates {
    const {currentPlayer} = this;
    const cellWidth = getCellWidth();
    const xFromCenter = (xVisibleCells - 1) / 2;
    const yFromCenter = (yVisibleCells - 1) / 2;
    const {x, y} = coordsToNumberCoords(coordinates);
    const offsetX = currentPlayer.x - x;
    const offsetY = currentPlayer.y - y;
    return {
      x: cellWidth / 2 + (offsetX + xFromCenter) * cellWidth + cellPadding + cellPadding * 2 * (offsetX + xFromCenter),
      y: cellWidth / 2 + (offsetY + yFromCenter) * cellWidth + cellPadding + cellPadding * 2 * (offsetY + yFromCenter),
    };
  }

  private drawCell(offsetX: number, offsetY: number, cell: Cell): void {
    const {currentPlayer} = this;
    const cellCoords: Coordinate = `${offsetX},${offsetY}`;
    const cellWidth = getCellWidth();
    const {x: coordX, y: coordY} = this.getCellCenterPointFromCoordinates(
      `${currentPlayer.x + offsetX},${currentPlayer.y + offsetY}`,
    );
    const circlePoint = new paper.Point(coordX, coordY);

    let raster: paper.Raster;
    switch (cell.type) {
      case CellType.VerticalDoor:
      case CellType.HorizontalDoor:
      case CellType.Earth:
        raster = new paper.Raster('dirt01');
        break;
      case CellType.Wall:
      default:
        raster = new paper.Raster('ground01');
        break;
    }
    raster.position = circlePoint;
    raster.scale(cellWidth / raster.width);
    raster.strokeWidth = 0;
    const clickHandler = (): void => this.handleCellClick(offsetX, offsetY);
    raster.onClick = clickHandler;
    this.drawnTiles[cellCoords] = new paper.Group([raster]);
    if (cell.type === CellType.VerticalDoor || cell.type === CellType.HorizontalDoor) {
      const door = new paper.Raster('door');
      if (cell.type === CellType.HorizontalDoor) {
        door.rotate(90);
      }
      door.position = circlePoint;
      door.scale(cellWidth / door.width);
      door.strokeWidth = 0;
      door.onClick = clickHandler;
    }

    const occupyingPlayer = this.players.find(
      (loopingPlayer) => loopingPlayer.x === cell.x && loopingPlayer.y === cell.y,
    );
    if (occupyingPlayer) {
      const myCircle = new paper.Path.Circle(circlePoint, cellWidth / 2);
      myCircle.fillColor = new paper.Color(occupyingPlayer.color);
      myCircle.strokeColor = BLACK;
      const circleGroup = new paper.Group([myCircle]);
      circleGroup.onClick = clickHandler;
      this.drawnMap[cellCoords] = circleGroup;
    }
  }

  private drawPlayerPath(player: Player): void {
    if (!player.currentAction?.path?.length || player.currentAction.path.length < 1) {
      return;
    }
    const path = new paper.Path();
    const {x: playerX, y: playerY} = this.getCellCenterPointFromCoordinates(`${player.x},${player.y}`);
    path.add(new paper.Point(playerX, playerY));
    player.currentAction.path.forEach((point) => {
      const {x, y} = this.getCellCenterPointFromCoordinates(point);
      path.add(new paper.Point(x, y));
    });
    path.strokeWidth = 10;
    path.strokeColor = new paper.Color(player.color);
    path.smooth();
    const {x: endingX, y: endingY} = this.getCellCenterPointFromCoordinates(
      player.currentAction.path[player.currentAction.path.length - 1],
    );

    const endingCircle = new paper.Path.Circle(new paper.Point(endingX, endingY), 10);
    endingCircle.fillColor = new paper.Color(player.color);
    endingCircle.strokeColor = new paper.Color(player.color);

    const pathGroup = new paper.Group([path, endingCircle]);
    this.drawnMovementPaths[player.playerId] = pathGroup;
  }

  private drawMap(): void {
    Object.entries(this.drawnMap).forEach(([key, cell]) => {
      cell.remove();
      delete this.drawnMap[key as Coordinate];
    });
    Object.entries(this.drawnTiles).forEach(([key, cell]) => {
      cell.remove();
      delete this.drawnTiles[key as Coordinate];
    });
    Object.entries(this.drawnMovementPaths).forEach(([key, path]) => {
      path.remove();
      delete this.drawnMovementPaths[key as string];
    });
    const {currentPlayer} = this;
    const xFromCenter = (xVisibleCells - 1) / 2;
    const yFromCenter = (yVisibleCells - 1) / 2;
    for (let offsetX = -1 * xFromCenter; offsetX <= xFromCenter; offsetX++) {
      for (let offSetY = -1 * yFromCenter; offSetY <= yFromCenter; offSetY++) {
        const cell = this.dungeonMap[this.level].cells[`${currentPlayer.x + offsetX},${currentPlayer.y + offSetY}`];
        if (cell !== undefined) {
          //Tile
          this.drawCell(offsetX, offSetY, cell);
        } else {
          // Out of bounds
        }
      }
    }
    this.players.forEach((player) => {
      if (player.currentAction?.name === PlayerActionName.Move && player.currentAction?.path?.length) {
        this.drawPlayerPath(player);
      }
    });
    this.playerBadges.forEach((badge) => {
      badge.bringToFront();
    });
  }
}
