export function swapScreens(currentScreen: string, newScreen: string): void {
  const currentScreenElement = document.getElementById(currentScreen);
  const newScreenElement = document.getElementById(newScreen);
  if (currentScreenElement && newScreenElement) {
    newScreenElement.classList.add('visible');
    currentScreenElement.classList.remove('visible');
  }
}

export function winGame(): void {
  const newScreenElement = document.getElementById('win-screen');
  if (newScreenElement) {
    newScreenElement.classList.add('visible');
  }
}
export function loseGame(): void {
  const newScreenElement = document.getElementById('lose-screen');
  if (newScreenElement) {
    newScreenElement.classList.add('visible');
  }
}
