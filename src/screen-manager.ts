import {LOCAL_STORAGE_GAME_ID, LOCAL_STORAGE_PLAYER_ID} from './consts';

export function swapScreens(currentScreen: string, newScreen: string): void {
  const currentScreenElement = document.getElementById(currentScreen);
  const newScreenElement = document.getElementById(newScreen);
  if (currentScreenElement && newScreenElement) {
    newScreenElement.classList.add('visible');
    currentScreenElement.classList.remove('visible');
  }
}

export function clearLocalStorage(): void {
  localStorage.removeItem(LOCAL_STORAGE_GAME_ID);
  localStorage.removeItem(LOCAL_STORAGE_PLAYER_ID);
}

export function winGame(): void {
  clearLocalStorage();
  swapScreens('game-canvas', 'win-screen');
}
export function loseGame(): void {
  clearLocalStorage();
  swapScreens('game-canvas', 'lose-screen');
}
