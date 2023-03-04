export type Player = {
  x: number;
  y: number;
  playerId: string;
  isHost: boolean;
};
export enum GameStatus {
  WaitingForPlayers,
  Ongoing,
  Saved,
  Done,
}
export type Game = {gameId: string; players: Player[]; status: GameStatus};
