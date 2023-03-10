export function swapScreens(currentScreen: string, newScreen: string): void {
  const currentScreenElement = document.getElementById(currentScreen);
  const newScreenElement = document.getElementById(newScreen);
  if (currentScreenElement && newScreenElement) {
    newScreenElement.classList.add('visible');
    currentScreenElement.classList.remove('visible');
  }
}

export function winGame(): void {
  swapScreens('game-canvas', 'win-screen');
}
export function loseGame(): void {
  swapScreens('game-canvas', 'lose-screen');
}
