import * as paper from 'paper';
import {Player} from '../types/SharedTypes';
import {BLACK, WHITE} from './colors';

const xVisibleCells = 7;
const yVisibleCells = 9;
const cellPadding = 1;

export class Game {
  path: paper.PointText;

  map: {[key: `${number},${number}`]: string};

  drawnMap: {[key: `${number},${number}`]: paper.Path};

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
    this.map = {};
    const maxX = 20;
    const maxY = 20;
    for (let x = 0; x < maxX; x++) {
      for (let y = 0; y < maxY; y++) {
        this.map[`${x},${y}`] = 'red';
      }
    }
    this.drawMap();
  }

  private get currentPlayer(): Player {
    return this.players.find((player) => player.playerId === globalThis.playerId) as Player;
  }

  private drawCell(x: number, y: number, cell: string): void {
    const {width} = globalThis.gameElement.getBoundingClientRect();
    const cellWidth = (width - cellPadding * 2 * xVisibleCells) / xVisibleCells;
    const xFromCenter = (xVisibleCells - 1) / 2;
    const yFromCenter = (yVisibleCells - 1) / 2;
    const myCircle = new paper.Path.Circle(
      new paper.Point(
        cellWidth / 2 + (x + xFromCenter) * cellWidth + cellPadding + cellPadding * 2 * (x + xFromCenter),
        cellWidth / 2 + (y + yFromCenter) * cellWidth + cellPadding + cellPadding * 2 * (y + yFromCenter),
      ),
      cellWidth / 2,
    );
    myCircle.fillColor = x === 0 && y === 0 ? WHITE : BLACK;
    myCircle.strokeColor = new paper.Color(cell);
    this.drawnMap[`${x},${y}`] = myCircle;
  }

  private drawMap(): void {
    const player = this.currentPlayer;
    const xFromCenter = (xVisibleCells - 1) / 2;
    const yFromCenter = (yVisibleCells - 1) / 2;
    for (let x = -1 * xFromCenter; x <= xFromCenter; x++) {
      for (let y = -1 * yFromCenter; y <= yFromCenter; y++) {
        const cell = this.map[`${player.x + x},${player.y + y}`];
        if (cell !== undefined) {
          //Tile
          this.drawCell(x, y, cell);
        } else {
          //Wall
          this.drawCell(x, y, cell);
        }
      }
    }
  }
}
