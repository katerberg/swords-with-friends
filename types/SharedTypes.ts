export enum PlayerActionName {
  Move,
}
export type PlayerAction = {
  name: PlayerActionName;
  target?: Coordinate;
  path?: Coordinate[];
};

export type Player = {
  x: number;
  y: number;
  playerId: string;
  name: string;
  isHost: boolean;
  socketId?: string;
  maxHp: number;
  currentHp: number;
  color: string;
  textColor: string;
  currentAction: PlayerAction | null;
  mapLevel: number;
};

export enum CellType {
  VerticalDoor,
  HorizontalDoor,
  Earth,
  Wall,
}

export type Cell = {
  x: number;
  y: number;
  isEntrance: boolean;
  isExit: boolean;
  isPassable: boolean;
  isWalkable: boolean;
  type: CellType;
};

export type Monster = {
  x: number;
  y: number;
};

export type DungeonMap = MapLevel[];

export type MapLevel = {
  monsters: Monster[];
  playerSpawn: Coordinate;
  monsterSpawn: Coordinate[];
  cells: {
    [key: Coordinate]: Cell;
  };
};

export type NumberCoordinates = {x: number; y: number};
export type Coordinate = `${number},${number}`;

export enum GameStatus {
  WaitingForPlayers,
  Ongoing,
  Saved,
  Done,
}

export type Game = {
  gameId: string;
  players: Player[];
  gameStatus: GameStatus;
  startTime: Date;
  lastActionTime: Date;
  turn: number;
  dungeonMap: DungeonMap;
};

export enum Messages {
  LeaveGame = 'leaveGame',
  GameClosed = 'gameClosed',
  GameStarted = 'gameStarted',
  CurrentGames = 'currentGames',
  StartGame = 'startGame',
  PlayersChangedInGame = 'playersChangedInGame',
  ChangeName = 'changeName',
  NameChanged = 'nameChanged',
  MovePlayer = 'movePlayer',
  PlayerActionQueued = 'playerActionQueued',
  TurnEnd = 'turnEnd',
}

export type GamesHash = {[key: string]: Game};

export type OnFrameEvent = {
  delta: number;
  time: number;
  count: number;
};
