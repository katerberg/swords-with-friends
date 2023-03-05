import * as paper from 'paper';
import {Cell, Coordinate, DungeonMap, Game, Messages, Player, PlayerAction} from '../types/SharedTypes';
import {BLACK, EARTH, SLATE} from './colors';

const xVisibleCells = 7;
const yVisibleCells = 11;
const cellPadding = 1;
const badgePadding = 6;

function getCellWidth(): number {
  const {width} = globalThis.gameElement.getBoundingClientRect();
  return (width - cellPadding * 2 * xVisibleCells) / xVisibleCells;
}

export class ClientGame {
  dungeonMap: DungeonMap;

  level: number;

  drawnMap: {[key: Coordinate]: paper.Group};

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
        fontSize: 10,
        fillColor: new paper.Color(player.textColor),
        content: '...',
      });
      return new paper.Group([circle, text]);
    });

    this.drawnMap = {};
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
    this.playerBadges.forEach((badgeGroup) => {
      const text = badgeGroup.lastChild as paper.PointText;
      text.content = '...';
      text.fontSize = 10;
    });
  }

  private setBadgeContent(playerId: string, content: string): void {
    const index = this.players.findIndex((player) => playerId === player.playerId);
    if (index === -1) {
      return;
    }
    const text = this.playerBadges[index].lastChild as paper.PointText;
    text.fontSize = 20;
    text.content = content;
  }

  private handlePlayerActionQueue(gameId: string, actionQueued: {action: PlayerAction; playerId: string}): void {
    if (gameId !== globalThis.currentGameId) {
      return;
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
    });
    this.resetAllBadgeContent();
    this.drawMap();
  }

  private handleCellClick(xOffset: number, yOffset: number): void {
    if (Math.abs(xOffset) < 2 && Math.abs(yOffset) < 2) {
      const x = this.currentPlayer.x + xOffset;
      const y = this.currentPlayer.y + yOffset;
      if (this.players.find((player) => player.x === x && player.y === y)) {
        return;
      }

      globalThis.socket.emit(Messages.MovePlayer, globalThis.currentGameId, x, y);
    }
  }

  private drawCell(offsetX: number, offsetY: number, cell: Cell): void {
    const cellWidth = getCellWidth();
    const xFromCenter = (xVisibleCells - 1) / 2;
    const yFromCenter = (yVisibleCells - 1) / 2;
    const circlePoint = new paper.Point(
      cellWidth / 2 + (offsetX + xFromCenter) * cellWidth + cellPadding + cellPadding * 2 * (offsetX + xFromCenter),
      cellWidth / 2 + (offsetY + yFromCenter) * cellWidth + cellPadding + cellPadding * 2 * (offsetY + yFromCenter),
    );
    const occupyingPlayer = this.players.find(
      (loopingPlayer) => loopingPlayer.x === cell.x && loopingPlayer.y === cell.y,
    );
    const myCircle = new paper.Path.Circle(circlePoint, cellWidth / 2);
    const fillColor = cell.isPassable ? EARTH : SLATE;
    myCircle.fillColor = occupyingPlayer ? new paper.Color(occupyingPlayer.color) : fillColor;
    myCircle.strokeColor = BLACK;
    const circleGroup = new paper.Group([myCircle]);
    circleGroup.onClick = (): void => this.handleCellClick(offsetX, offsetY);
    this.drawnMap[`${offsetX},${offsetY}`] = circleGroup;
  }

  private drawMap(): void {
    Object.entries(this.drawnMap).forEach(([key, cell]) => {
      cell.remove();
      delete this.drawnMap[key as Coordinate];
    });
    const player = this.currentPlayer;
    const xFromCenter = (xVisibleCells - 1) / 2;
    const yFromCenter = (yVisibleCells - 1) / 2;
    for (let offsetX = -1 * xFromCenter; offsetX <= xFromCenter; offsetX++) {
      for (let y = -1 * yFromCenter; y <= yFromCenter; y++) {
        const cell = this.dungeonMap[this.level][`${player.x + offsetX},${player.y + y}`];
        if (cell !== undefined) {
          //Tile
          this.drawCell(offsetX, y, cell);
        } else {
          // Out of bounds
        }
      }
    }
    this.playerBadges.forEach((badge) => {
      badge.bringToFront();
    });
  }
}
