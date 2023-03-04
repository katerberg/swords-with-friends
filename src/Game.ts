import * as paper from 'paper';
import {BLACK} from './colors';

export class Game {
  path: paper.PointText;

  constructor() {
    this.path = new paper.PointText({
      point: paper.view.center.transform(new paper.Matrix().translate(0, 230)),
      justification: 'center',
      fontSize: 20,
      fillColor: BLACK,
      content: `Game ID
                ${globalThis.currentGameId}`,
    });
  }
}
