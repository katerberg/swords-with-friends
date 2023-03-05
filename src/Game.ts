import * as paper from 'paper';
import {MAX_X, MAX_Y} from '../types/consts';
import {Cell, CellType, Coordinate, MapLevel, Messages, Player} from '../types/SharedTypes';
import {BLACK, WHITE} from './colors';

const xVisibleCells = 7;
const yVisibleCells = 11;
const cellPadding = 1;

export class Game {
  path: paper.PointText;

  map: MapLevel[];

  level: number;

  drawnMap: {[key: Coordinate]: paper.Path};

  players: Player[];

  constructor(players: Player[]) {
    this.path = new paper.PointText({
      point: paper.view.center.transform(new paper.Matrix().translate(0, 230)),
      justification: 'center',
      fontSize: 20,
      fillColor: BLACK,
      content: `Game ID
                ${globalThis.currentGameId}`,
    });
    this.players = players;
    this.drawnMap = {};
    this.level = 0;
    this.map = [{}];
    for (let x = 0; x <= MAX_X; x++) {
      for (let y = 0; y <= MAX_Y; y++) {
        this.map[this.level][`${x},${y}`] = {
          type: CellType.Earth,
          x,
          y,
          isPassable: true,
          isWalkable: true,
          isEntrance: false,
          isExit: false,
        };
      }
    }
    globalThis.socket.on(Messages.PlayerMoved, this.handlePlayerMoved.bind(this));
    this.drawMap();
  }

  private get currentPlayer(): Player {
    return this.players.find((player) => player.playerId === globalThis.playerId) as Player;
  }

  private handlePlayerMoved(game: string, player: Player): void {
    if (game !== globalThis.currentGameId) {
      return;
    }
    const index = this.players.findIndex((currentPlayer) => currentPlayer.playerId === player.playerId);
    this.players[index].x = player.x;
    this.players[index].y = player.y;
    this.drawMap();
  }

  private handleCellClick(x: number, y: number): void {
    if (x === 0 && y === 0) {
      return;
    }
    if (Math.abs(x) < 2 && Math.abs(y) < 2) {
      globalThis.socket.emit(
        Messages.MovePlayer,
        globalThis.currentGameId,
        this.currentPlayer.x + x,
        this.currentPlayer.y + y,
      );
    }
  }

  private drawCell(offsetX: number, offsetY: number, cell: Cell): void {
    const {width} = globalThis.gameElement.getBoundingClientRect();
    const cellWidth = (width - cellPadding * 2 * xVisibleCells) / xVisibleCells;
    const xFromCenter = (xVisibleCells - 1) / 2;
    const yFromCenter = (yVisibleCells - 1) / 2;
    const circlePoint = new paper.Point(
      cellWidth / 2 + (offsetX + xFromCenter) * cellWidth + cellPadding + cellPadding * 2 * (offsetX + xFromCenter),
      cellWidth / 2 + (offsetY + yFromCenter) * cellWidth + cellPadding + cellPadding * 2 * (offsetY + yFromCenter),
    );
    const myCircle = new paper.Path.Circle(circlePoint, cellWidth / 2);
    const occupyingPlayer = this.players.find(
      (loopingPlayer) => loopingPlayer.x === cell.x && loopingPlayer.y === cell.y,
    );
    const player = this.currentPlayer;
    const text = new paper.PointText({
      point: circlePoint,
      justification: 'center',
      fontSize: 10,
      fillColor: occupyingPlayer ? new paper.Color(occupyingPlayer.textColor) : WHITE,
      content: `${offsetX + player.x},${offsetY + player.y}`,
    });
    myCircle.addChild(text);
    myCircle.fillColor = occupyingPlayer ? new paper.Color(occupyingPlayer.color) : BLACK;
    myCircle.strokeColor = new paper.Color('red');
    myCircle.onClick = (): void => this.handleCellClick(offsetX, offsetY);
    this.drawnMap[`${offsetX},${offsetY}`] = myCircle;
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
        const cell = this.map[this.level][`${player.x + offsetX},${player.y + y}`];
        if (cell !== undefined) {
          //Tile
          this.drawCell(offsetX, y, cell);
        } else {
          //Wall
        }
      }
    }
  }
}
