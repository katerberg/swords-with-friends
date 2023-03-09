import * as paper from 'paper';
import {MAX_X, MAX_Y, X_VISIBLE_CELLS, Y_VISIBLE_CELLS} from '../types/consts';
import {calculateDistanceBetween, coordsToNumberCoords} from '../types/math';
import {
  Cell,
  CellType,
  Coordinate,
  DungeonMap,
  Game,
  Item,
  Messages,
  NumberCoordinates,
  Player,
  PlayerAction,
  PlayerActionName,
  VisiblityStatus,
} from '../types/SharedTypes';
import {BLACK, FOV_SEEN_OVERLAY, INVENTORY_BACKGROUND, TRANSPARENT, WHITE} from './colors';
import {
  getBacking,
  getCellOffsetFromMouseEvent,
  getHpBar,
  getInventoryItemSelectedMessage,
  getMonster,
  getRasterStringForPlayer,
  getRasterStringFromItems,
  getRemainingTurnsBadge,
} from './drawing';
import {loseGame, winGame} from './screen-manager';

const cellPadding = 0;
const badgePadding = 6;

export function getCellWidth(): number {
  const {width} = globalThis.gameElement.getBoundingClientRect();
  return (width - cellPadding * 2 * X_VISIBLE_CELLS) / X_VISIBLE_CELLS;
}

export class ClientGame {
  dungeonMap: DungeonMap;

  drawnReticles: {[playerId: string]: paper.Group};

  drawnTiles: {[key: Coordinate]: paper.Group};

  drawnPlayers: {[key: Coordinate]: paper.Group};

  drawnMonsters: {[key: string]: paper.Group};

  drawnMovementPaths: {[playerId: string]: paper.Group};

  drawnInventory: paper.Group | null;

  selectedInventoryItem: Item | null;

  players: Player[];

  inventoryButton: paper.Group;

  isInventoryOpen: boolean;

  message: paper.Group | null;

  playerBadges: {[playerId: string]: paper.Group};

  piggybackView: Player | null;

  constructor(game: Game) {
    this.players = game.players;

    this.piggybackView = null;
    this.playerBadges = this.getPlayerBadges(game);
    this.isInventoryOpen = false;
    this.inventoryButton = this.getInventoryButton();

    this.drawnPlayers = {};
    this.drawnMonsters = {};
    this.drawnReticles = {};
    this.drawnMovementPaths = {};
    this.drawnTiles = {};
    this.drawnInventory = null;
    this.selectedInventoryItem = null;
    this.message = null;
    this.dungeonMap = game.dungeonMap;

    globalThis.socket.on(Messages.GameWon, this.handleWonGame.bind(this));
    globalThis.socket.on(Messages.GameLost, this.handleLostGame.bind(this));
    globalThis.socket.on(Messages.TurnEnd, this.handleTurnEnd.bind(this));
    globalThis.socket.on(Messages.PlayerActionQueued, this.handlePlayerActionQueue.bind(this));
    this.drawMap();
  }

  private toggleInventoryOpen(): void {
    const backpack = this.inventoryButton.lastChild as paper.Raster;
    backpack.rotation = this.isInventoryOpen ? 0 : 30;
    backpack.source = (backpack.source as string)
      .replace('unlit', 'blah')
      .replace('lit', 'unlit')
      .replace('blah', 'lit');
    this.isInventoryOpen = !this.isInventoryOpen;
    this.selectedInventoryItem = null;
  }

  private getInventoryButton(): paper.Group {
    const {height, width} = globalThis.gameElement.getBoundingClientRect();
    const cellWidth = getCellWidth();
    const circlePoint = new paper.Point(width - cellWidth, height - cellWidth);
    const circle = new paper.Shape.Circle(circlePoint, cellWidth / 2);
    circle.strokeWidth = 3;
    circle.shadowColor = BLACK;
    circle.shadowBlur = 12;
    circle.fillColor = new paper.Color('green');
    circle.strokeColor = BLACK;
    const backpack = new paper.Raster('backpack-unlit');
    const rasterScale = getCellWidth() / backpack.width;
    backpack.scale(rasterScale);
    backpack.position = circlePoint;
    const group = new paper.Group([circle, backpack]);
    group.onClick = (): void => {
      this.piggybackView = null;
      this.selectedInventoryItem = null;
      this.clearMessage();
      this.toggleInventoryOpen();
      this.drawMap();
    };
    return group;
  }

  private getPlayerBadges(game: Game): {[playerId: string]: paper.Group} {
    const {height, width} = globalThis.gameElement.getBoundingClientRect();
    const cellWidth = getCellWidth();
    const {playerId} = this.currentPlayer;
    const badgePlayers = game.players
      .map((p) => ({playerId: p.playerId, color: p.color, textColor: p.textColor}))
      .sort((a, b) => {
        if (a.playerId === playerId) {
          return -1;
        }
        if (b.playerId === playerId) {
          return 1;
        }
        return 0;
      });
    const badges: {[playerId: string]: paper.Group} = {};
    badgePlayers.forEach((player, index) => {
      const i = index + 1;
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
      const group = new paper.Group([circle, text]);
      group.onClick = (): void => this.handleBadgeClick(player.playerId);
      badges[player.playerId] = group;
    });
    return badges;
  }

  private get level(): number {
    return this.players[0].mapLevel;
  }

  private get currentPlayer(): Player {
    return this.players.find(
      (player) => player.playerId === (this.piggybackView ? this.piggybackView.playerId : globalThis.playerId),
    ) as Player;
  }

  private getPlayer(playerId: string): Player | undefined {
    return this.players.find((gamePlayer) => gamePlayer.playerId === playerId);
  }

  private clearMessage(): void {
    this.message?.remove();
    this.message = null;
  }

  private handleBadgeClick(playerId: string): void {
    const player = this.getPlayer(playerId);
    if (player) {
      this.clearMessage();
      this.selectedInventoryItem = null;
      this.piggybackView = player;
      this.drawMap();
    }
  }

  // eslint-disable-next-line class-methods-use-this
  private handleWonGame(gameId: string): void {
    if (gameId === globalThis.currentGameId) {
      winGame();
    }
  }

  // eslint-disable-next-line class-methods-use-this
  private handleLostGame(gameId: string): void {
    if (gameId === globalThis.currentGameId) {
      loseGame();
    }
  }

  private resetAllBadgeContent(): void {
    Object.keys(this.playerBadges).forEach((playerId) => {
      const text = this.playerBadges[playerId].lastChild as paper.PointText;
      if (this.getPlayer(playerId)?.currentAction === null) {
        text.content = '...';
      }
    });
  }

  private setBadgeContent(playerId: string, content: string): void {
    const text = this.playerBadges[playerId].lastChild as paper.PointText;
    text.content = content;
  }

  private handlePlayerActionQueue(gameId: string, actionQueued: {action: PlayerAction; playerId: string}): void {
    if (gameId !== globalThis.currentGameId) {
      return;
    }
    const player = this.getPlayer(actionQueued.playerId);
    if (player) {
      player.currentAction = actionQueued.action;
      if (actionQueued.action.name === PlayerActionName.Move || actionQueued.action.name === PlayerActionName.UseItem) {
        this.drawMap();
      }
    }
    this.setBadgeContent(actionQueued.playerId, '✓');
  }

  private handleTurnEnd(gameId: string, game: Game): void {
    if (gameId !== globalThis.currentGameId) {
      return;
    }

    this.dungeonMap = game.dungeonMap;
    this.players.forEach((thisPlayer) => {
      const updatedPlayer = game.players.find((gamePlayer) => gamePlayer.playerId === thisPlayer.playerId) as Player;
      thisPlayer.x = updatedPlayer.x;
      thisPlayer.y = updatedPlayer.y;
      thisPlayer.statusEffects = updatedPlayer.statusEffects;
      thisPlayer.items.length = 0;
      updatedPlayer.items.forEach((item) => {
        thisPlayer.items.push(item);
      });
      thisPlayer.mapLevel = updatedPlayer.mapLevel;
      thisPlayer.currentHp = updatedPlayer.currentHp;
      thisPlayer.maxHp = updatedPlayer.maxHp;
      thisPlayer.currentAction = updatedPlayer.currentAction;
    });
    this.resetAllBadgeContent();
    this.drawMap();
  }

  private handleCellClick(xOffset: number, yOffset: number): void {
    const x = this.currentPlayer.x + xOffset;
    const y = this.currentPlayer.y + yOffset;
    this.piggybackView = null;
    if (!this.dungeonMap[this.level].cells[`${x},${y}`].isPassable) {
      return;
    }

    if (!this.selectedInventoryItem) {
      globalThis.socket.emit(Messages.MovePlayer, globalThis.currentGameId, x, y);
    } else {
      globalThis.socket.emit(Messages.UseItem, globalThis.currentGameId, x, y, this.selectedInventoryItem.itemId);
      this.clearMessage();
      this.selectedInventoryItem = null;
    }
  }

  private getCellCenterPointFromCoordinates(coordinates: Coordinate): NumberCoordinates {
    const {currentPlayer} = this;
    const cellWidth = getCellWidth();
    const xFromCenter = (X_VISIBLE_CELLS - 1) / 2;
    const yFromCenter = (Y_VISIBLE_CELLS - 1) / 2;
    const {x, y} = coordsToNumberCoords(coordinates);
    const offsetX = currentPlayer.x - x;
    const offsetY = currentPlayer.y - y;
    return {
      x: cellWidth / 2 + (offsetX + xFromCenter) * cellWidth + cellPadding + cellPadding * 2 * (offsetX + xFromCenter),
      y: cellWidth / 2 + (offsetY + yFromCenter) * cellWidth + cellPadding + cellPadding * 2 * (offsetY + yFromCenter),
    };
  }

  private handlePotentialReticle(
    cell: Cell,
    circlePoint: paper.Point,
    cellCoords: Coordinate,
    clickHandler: () => void,
  ): void {
    const player = this.players.find(
      (p) => p.currentAction?.name === PlayerActionName.UseItem && p.currentAction.target === `${cell.x},${cell.y}`,
    );
    if (player) {
      const cellWidth = getCellWidth();
      const raster = new paper.Raster('reticle');
      raster.position = circlePoint;
      const rasterScale = (cellWidth * 0.5) / raster.width;
      raster.scale(rasterScale);
      raster.shadowColor = new paper.Color(player.color);
      raster.shadowBlur = 22;
      const backing = new paper.Shape.Circle(circlePoint, raster.width * rasterScale * 0.3);
      backing.fillColor = new paper.Color(player.color);
      const reticle = new paper.Group([backing, raster]);
      reticle.onClick = clickHandler;

      this.drawnReticles[player.playerId] = reticle;
    }
  }

  private handlePotentialExit(cell: Cell, circlePoint: paper.Point, cellCoords: Coordinate): void {
    if (cell.type === CellType.Exit) {
      const cellWidth = getCellWidth();
      const exitSigil = new paper.Raster('cosmic09');
      exitSigil.position = circlePoint;
      exitSigil.scale(cellWidth / exitSigil.width);
      exitSigil.strokeWidth = 0;
      exitSigil.shadowColor = WHITE;
      exitSigil.shadowBlur = 12;
      this.drawnTiles[cellCoords].addChild(exitSigil);
    }
  }

  private handlePotentialItem(cell: Cell, circlePoint: paper.Point, cellCoords: Coordinate): void {
    if (cell.items.length) {
      const rasterImage = getRasterStringFromItems(cell.items);
      if (rasterImage !== '') {
        const cellWidth = getCellWidth();
        const item = new paper.Raster(rasterImage);
        item.position = circlePoint;
        item.scale(cellWidth / item.width);
        item.strokeWidth = 0;
        if (rasterImage.includes('sword')) {
          item.shadowColor = WHITE;
          item.shadowBlur = 12;
          item.scale(0.8);
          item.rotate(-30);
        }
        this.drawnTiles[cellCoords].addChild(item);
      }
    }
  }

  private handlePotentialDoor(cell: Cell, circlePoint: paper.Point, cellCoords: Coordinate): void {
    if (cell.type === CellType.VerticalDoor || cell.type === CellType.HorizontalDoor) {
      const cellWidth = getCellWidth();
      const door = new paper.Raster('door');
      if (cell.type === CellType.HorizontalDoor) {
        door.rotate(90);
      }
      door.position = circlePoint;
      door.scale(cellWidth / door.width);
      door.strokeWidth = 0;
      this.drawnTiles[cellCoords].addChild(door);
    }
  }

  private drawPlayer(player: Player, circlePoint: paper.Point, cellCoords: Coordinate, clickHandler: () => void): void {
    const playerRaster = new paper.Raster(getRasterStringForPlayer(player));
    playerRaster.position = circlePoint;
    const playerRasterScale = (getCellWidth() / playerRaster.width) * 0.8;
    playerRaster.scale(playerRasterScale);
    playerRaster.shadowColor = WHITE;
    playerRaster.shadowBlur = 22;
    const playerGroup = new paper.Group([
      getBacking(player.color, circlePoint, playerRaster.width * playerRasterScale),
      playerRaster,
    ]);
    if (player.currentHp < player.maxHp && player.currentHp > 0) {
      playerGroup.addChild(getHpBar(player, circlePoint, playerRaster.width * playerRasterScale));
    }
    if (player.statusEffects.length > 0) {
      playerGroup.addChild(getRemainingTurnsBadge(player, circlePoint, playerRaster.width * playerRasterScale));
    }
    playerGroup.onClick = clickHandler;
    this.drawnPlayers[cellCoords] = playerGroup;
  }

  private handleFovOverlay(cell: Cell, center: paper.Point, cellCoords: Coordinate, width: number): void {
    if (cell.visibilityStatus === VisiblityStatus.Seen) {
      const rectTLPoint = new paper.Point(center);
      rectTLPoint.x -= width / 2;
      rectTLPoint.y -= width / 2;
      const rectBRPoint = new paper.Point(center);
      rectBRPoint.x += width / 2;
      rectBRPoint.y += width / 2;
      const fovOverlay = new paper.Shape.Rectangle(rectTLPoint, rectBRPoint);
      fovOverlay.strokeWidth = 0;
      fovOverlay.fillColor = FOV_SEEN_OVERLAY;
      this.drawnTiles[cellCoords].addChild(fovOverlay);
    }
  }

  private drawCell(offsetX: number, offsetY: number, cell: Cell): void {
    const {currentPlayer} = this;
    const cellCoords: Coordinate = `${offsetX},${offsetY}`;
    const cellWidth = getCellWidth();
    const {x: coordX, y: coordY} = this.getCellCenterPointFromCoordinates(
      `${currentPlayer.x + offsetX},${currentPlayer.y + offsetY}`,
    );
    const circlePoint = new paper.Point(coordX, coordY);

    // Cell background
    let cellBackgroundRaster: paper.Raster;
    if (cell.visibilityStatus === VisiblityStatus.Unseen) {
      cellBackgroundRaster = new paper.Raster('black');
    } else {
      switch (cell.type) {
        case CellType.VerticalDoor:
        case CellType.HorizontalDoor:
        case CellType.Earth:
        case CellType.Exit:
          cellBackgroundRaster = new paper.Raster('dirt01');
          break;
        case CellType.Wall:
        default:
          cellBackgroundRaster = new paper.Raster('ground01');
          break;
      }
    }
    cellBackgroundRaster.position = circlePoint;
    const rasterScale = cellWidth / cellBackgroundRaster.width + 0.003;
    cellBackgroundRaster.scale(cellWidth / cellBackgroundRaster.width + 0.003);
    cellBackgroundRaster.strokeWidth = 0;
    this.drawnTiles[cellCoords] = new paper.Group([cellBackgroundRaster]);
    // Visible Cells
    if (cell.visibilityStatus !== VisiblityStatus.Unseen) {
      const clickHandler = (): void => this.handleCellClick(offsetX, offsetY);
      this.handlePotentialExit(cell, circlePoint, cellCoords);
      this.handlePotentialDoor(cell, circlePoint, cellCoords);
      this.handlePotentialItem(cell, circlePoint, cellCoords);
      this.handleFovOverlay(cell, circlePoint, cellCoords, cellBackgroundRaster.width * rasterScale);

      // Player in cell
      let occupyingPlayer = this.players.find(
        (loopingPlayer) => loopingPlayer.x === cell.x && loopingPlayer.y === cell.y,
      );
      if (occupyingPlayer) {
        if (occupyingPlayer?.currentHp <= 0) {
          const standingPlayer = this.players.find(
            (loopingPlayer) => loopingPlayer.x === cell.x && loopingPlayer.y === cell.y && loopingPlayer.currentHp > 0,
          );
          if (standingPlayer) {
            occupyingPlayer = standingPlayer;
          }
        }
        this.drawPlayer(occupyingPlayer, circlePoint, cellCoords, clickHandler);
      }
      if (this.players.length > 1) {
        this.handlePotentialReticle(cell, circlePoint, cellCoords, clickHandler);
      }
      this.drawnTiles[cellCoords].onClick = clickHandler;
    }
  }

  private drawMonsters(): void {
    this.dungeonMap[this.level].monsters.forEach((monster) => {
      if (this.dungeonMap[this.level].cells[`${monster.x},${monster.y}`].visibilityStatus === VisiblityStatus.Visible) {
        const monsterGroup = getMonster(monster, this.getCellCenterPointFromCoordinates(`${monster.x},${monster.y}`));
        monsterGroup.onClick = (): void =>
          this.handleCellClick(monster.x - this.currentPlayer.x, monster.y - this.currentPlayer.y);
        this.drawnMonsters[monster.monsterId] = monsterGroup;
      }
    });
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
    pathGroup.onClick = (e: paper.MouseEvent): void => {
      const {x, y} = getCellOffsetFromMouseEvent(e);
      this.handleCellClick(x, y);
    };
    this.drawnMovementPaths[player.playerId] = pathGroup;
  }

  private clearExistingDrawings(): void {
    // clear inventory
    if (this.drawnInventory !== null) {
      this.drawnInventory.remove();
      this.drawnInventory = null;
    }

    Object.entries(this.drawnReticles).forEach(([playerId, reticle]) => {
      reticle.remove();
      delete this.drawnReticles[playerId];
    });
    Object.entries(this.drawnPlayers).forEach(([key, cell]) => {
      cell.remove();
      delete this.drawnPlayers[key as Coordinate];
    });
    Object.entries(this.drawnTiles).forEach(([key, cell]) => {
      cell.remove();
      delete this.drawnTiles[key as Coordinate];
    });
    Object.entries(this.drawnMovementPaths).forEach(([key, path]) => {
      path.remove();
      delete this.drawnMovementPaths[key as string];
    });
    Object.entries(this.drawnMonsters).forEach(([key, image]) => {
      image.remove();
      delete this.drawnMonsters[key as string];
    });
  }

  private handleInventoryItemClick(item: Item): void {
    this.toggleInventoryOpen();
    this.selectedInventoryItem = item;
    this.message = getInventoryItemSelectedMessage();
    this.drawMap();
  }

  private getInventoryItems(): paper.Group[] {
    const {items} = this.currentPlayer;
    const cellWidth = getCellWidth();

    const cellPositions: paper.Point[] = [];
    for (let row = 1; row <= 3; row++) {
      for (let column = 1; column <= 6; column++) {
        cellPositions.push(new paper.Point(cellWidth * column, cellWidth * (row + 0.5)));
      }
    }
    return items.map((item, i) => {
      if (!cellPositions[i]) {
        return new paper.Group([]);
      }
      const raster = new paper.Raster(getRasterStringFromItems([item]));
      raster.position = cellPositions[i];
      const rasterScale = (getCellWidth() / raster.width) * 0.7;
      raster.scale(rasterScale);
      const backing = new paper.Shape.Circle(raster.position, (0.7 * cellWidth) / 2);
      backing.fillColor = BLACK;
      backing.strokeWidth = 0;
      const label = new paper.PointText(cellPositions[i]);
      label.position.y += cellWidth * 0.55;
      label.content = item.subtype;
      label.fillColor = BLACK;
      label.justification = 'center';
      const group = new paper.Group([backing, raster, label]);
      group.onClick = (): void => this.handleInventoryItemClick(item);
      return group;
    });
  }

  private drawInventory(): void {
    const cellWidth = getCellWidth();
    const {width, height} = globalThis.gameElement.getBoundingClientRect();
    const transparentBackground = new paper.Shape.Rectangle(new paper.Point(0, 0), new paper.Point(width, height));
    transparentBackground.fillColor = TRANSPARENT;
    transparentBackground.onClick = (): void => {
      this.toggleInventoryOpen();
      this.drawMap();
    };
    const tlPoint = new paper.Point(cellWidth * 0.5, cellWidth * 0.5);
    const brPoint = new paper.Point(cellWidth * (X_VISIBLE_CELLS - 0.5), cellWidth * 4);
    const inventoryBackground = new paper.Shape.Rectangle(tlPoint, brPoint);
    inventoryBackground.fillColor = INVENTORY_BACKGROUND;
    const title = new paper.PointText(new paper.Point((cellWidth * (X_VISIBLE_CELLS - 1.5)) / 2, cellWidth));
    title.content = 'Inventory';
    title.strokeColor = BLACK;
    title.fontSize = 20;
    title.fontWeight = 100;
    this.drawnInventory = new paper.Group([transparentBackground, inventoryBackground, title]);
    this.getInventoryItems().forEach((item) => {
      this.drawnInventory?.addChild(item);
    });
  }

  private drawMap(): void {
    this.clearExistingDrawings();

    const {x: playerX, y: playerY} = this.currentPlayer;
    for (let cellX = 0; cellX < MAX_X; cellX++) {
      for (let cellY = 0; cellY < MAX_Y; cellY++) {
        const cell = this.dungeonMap[this.level].cells[`${cellX},${cellY}`];
        if (cell !== undefined) {
          //Tile
          this.drawCell(cellX - playerX, cellY - playerY, cell);
        } else {
          // Out of bounds
        }
      }
    }

    this.drawMonsters();

    if (
      this.players.length > 1 ||
      (this.players[0].currentAction?.target &&
        calculateDistanceBetween(this.players[0], coordsToNumberCoords(this.players[0].currentAction.target)) >= 2)
    ) {
      this.players.forEach((p) => {
        if (p.currentAction?.name === PlayerActionName.Move && p.currentAction?.path?.length) {
          this.drawPlayerPath(p);
        }
      });
    }

    Object.values(this.playerBadges).forEach((badge) => {
      badge.bringToFront();
    });
    this.message?.bringToFront();
    if (this.isInventoryOpen) {
      this.drawInventory();
    }
    this.inventoryButton.bringToFront();
  }
}
