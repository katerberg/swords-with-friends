export enum PlayerActionName {
  Move,
  UseItem,
  LayDead,
  WaitOnExit,
}

export type PlayerAction = {
  name: PlayerActionName;
  target?: Coordinate;
  path?: Coordinate[];
  item?: string;
};

export enum CharacterName {
  Dead = 'character-dead',
  Frozen = 'character-frozen',
  Pinned = 'character-pinned',
  SwordsMan = 'character-swordsman',
  SwordsWoman = 'character-swordswoman',
}

export enum StatusEffectName {
  Pinned,
  Frozen,
}

export type StatusEffect = {
  name: StatusEffectName;
  remainingTurns: number;
};

export type Player = {
  x: number;
  y: number;
  items: Item[];
  playerId: string;
  character: CharacterName;
  equipment: GearItem | null;
  name: string;
  isHost: boolean;
  socketId: string | null;
  maxHp: number;
  currentHp: number;
  minAttackStrength: number;
  maxAttackStrength: number;
  color: string;
  textColor: string;
  currentAction: PlayerAction | null;
  mapLevel: number;
  statusEffects: StatusEffect[];
};

export enum CellType {
  VerticalDoor,
  HorizontalDoor,
  Earth,
  Exit,
  Wall,
}

export enum ItemType {
  Gear,
  Trophy,
  Potion,
}

export enum GearType {
  SwordBasic = 'Basic',
  SwordAcid = 'Acid',
  SwordVampire = 'Vampiric',
  SwordAngel = 'Angelic',
}

export enum TrophyType {
  Trophy = 'Orb',
}

export enum PotionType {
  Health = 'Health',
  Acid = 'Acid',
  Teleport = 'Teleport',
  Summon = 'Summon',
  GoStone = 'Go Stone',
}

export type GearItem = {
  itemId: string;
  type: ItemType.Gear;
  subtype: GearType;
  minAttack: number;
  maxAttack: number;
};

export type PotionItem = {
  itemId: string;
  type: ItemType;
  subtype: PotionType;
};

export type Item = {
  itemId: string;
  type: ItemType;
  subtype: PotionType | GearType | TrophyType;
  minAttack?: number;
  maxAttack?: number;
};

export type Cell = {
  x: number;
  y: number;
  isEntrance: boolean;
  isExit: boolean;
  isPassable: boolean;
  isWalkable: boolean;
  type: CellType;
  visibilityStatus: VisiblityStatus;
  items: Item[];
};

export enum MonsterType {
  Medusa,
  Slime,
  Goblin,
  Orc,
  Vampire,
  Tarball,
}

export type Monster = {
  monsterId: string;
  type: MonsterType;
  maxHp: number;
  currentHp: number;
  minAttackStrength: number;
  maxAttackStrength: number;
  target: Coordinate | null;
  x: number;
  y: number;
};

export type DungeonMap = MapLevel[];

export type MapLevel = {
  monsters: Monster[];
  playerSpawn: Coordinate;
  monsterSpawn: Coordinate[];
  exits: Coordinate[];
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
  Lost,
  Won,
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
  GameLost = 'gameLost',
  GameWon = 'gameWon',
  CurrentGames = 'currentGames',
  StartGame = 'startGame',
  PlayersChangedInGame = 'playersChangedInGame',
  ChangeName = 'changeName',
  ChangeCharacter = 'changeCharacter',
  NameChanged = 'nameChanged',
  CharacterChanged = 'characterChanged',
  MovePlayer = 'movePlayer',
  PlayerActionQueued = 'playerActionQueued',
  TurnEnd = 'turnEnd',
  UseItem = 'useItem',
  TryToReconnect = 'tryToReconnect',
  ReconnectFailed = 'reconnectFailed',
  ReconnectSuccessful = 'reconnectSuccessful',
  PlayerDisconnected = 'playerDisconnected',
  PlayerReconnected = 'playerReconnected',
}

export enum VisiblityStatus {
  Unseen,
  Seen,
  Visible,
}

export type GamesHash = {[key: string]: Game};
