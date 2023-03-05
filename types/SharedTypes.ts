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
};

export type Coordinate = `${number},${number}`;

export enum GameStatus {
  WaitingForPlayers,
  Ongoing,
  Saved,
  Done,
}

export type Game = {gameId: string; players: Player[]; status: GameStatus; startTime: Date};

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
  PlayerMoved = 'playerMoved',
}
