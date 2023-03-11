import {CharacterName, Game, Messages, Player} from '../types/SharedTypes';
import {ClientGame} from './ClientGame';
import {isDebug} from './debug';
import {swapScreens} from './screen-manager';

let playerCount = 1;
let warned = false;

function nameChange(newName: string): void {
  globalThis.socket.emit(Messages.ChangeName, globalThis.currentGameId, newName);
}

function characterChange(newCharacter: CharacterName): void {
  globalThis.socket.emit(Messages.ChangeCharacter, globalThis.currentGameId, newCharacter);
}

function leaveGame(): void {
  globalThis.socket.off(Messages.GameStarted);
  globalThis.socket.off(Messages.NameChanged);
  swapScreens('waiting-room', 'start-screen');
}

async function startGame(game: Game): Promise<void> {
  swapScreens('waiting-room', 'game-canvas');
  globalThis.clientGame = new ClientGame(game);
}

export function handleStartGame(): void {
  if (!isDebug() && !warned && playerCount === 1) {
    const waitingRoomTitle = document.getElementById('waiting-room-title');
    if (waitingRoomTitle) {
      waitingRoomTitle.innerHTML = 'Multiplayer recommended. Are you sure?';
    }

    const startGameButton = document.getElementById('start-game');
    if (startGameButton) {
      startGameButton.innerHTML = 'Proceed';
    }

    warned = true;
    return;
  }

  globalThis.socket.emit(Messages.StartGame, globalThis.currentGameId);
  swapScreens('waiting-room', 'game-canvas');
}

function getSrcFromCharacterName(character: CharacterName): string {
  switch (character) {
    case CharacterName.SwordsMan:
      return './images/characters/swordsman.png';
    case CharacterName.SwordsWoman:
      return './images/characters/swordswoman.png';
    case CharacterName.Pikeman:
      return './images/characters/pikeman.png';
    case CharacterName.HoodedAssassin:
      return './images/characters/hooded-assassin.png';
    case CharacterName.HighKick:
      return './images/characters/high-kick.png';
    case CharacterName.Caveman:
      return './images/characters/caveman.png';
    default:
      return './images/characters/dead.png';
  }
}

function changeToNextCharacter(currentCharacter: string): string {
  if (currentCharacter.includes('swordswoman')) {
    characterChange(CharacterName.SwordsMan);
    return './images/characters/swordsman.png';
  }
  if (currentCharacter.includes('swordsman')) {
    characterChange(CharacterName.Caveman);
    return './images/characters/caveman.png';
  }
  if (currentCharacter.includes('caveman')) {
    characterChange(CharacterName.HighKick);
    return './images/characters/high-kick.png';
  }
  if (currentCharacter.includes('high-kick')) {
    characterChange(CharacterName.HoodedAssassin);
    return './images/characters/hooded-assassin.png';
  }
  if (currentCharacter.includes('hooded-assassin')) {
    characterChange(CharacterName.Pikeman);
    return './images/characters/pikeman.png';
  }
  characterChange(CharacterName.SwordsWoman);
  return './images/characters/swordswoman.png';
}

export function populatePlayerList(players: Player[]): void {
  const startGameButton = document.getElementById('start-game');
  if (startGameButton) {
    startGameButton.classList.remove('visible');
  }
  playerCount = players.length;
  const playerLobbyList = document.getElementById('waiting-room-list');
  if (playerLobbyList) {
    while (playerLobbyList.firstChild) {
      playerLobbyList.removeChild(playerLobbyList.firstChild);
    }

    let isHost = false;
    let playerList = '<div class="player-list">';
    players.forEach((player) => {
      if (player.playerId === globalThis.playerId) {
        playerList += `<div class="player-list-row"><img id="character-change-icon" style="background-color: ${
          player.color
        };" class="character-change-icon" src="${getSrcFromCharacterName(
          player.character,
        )}" /><span id="character-change-chevron" class="character-change-chevron">›</span><input id="name-change-input" value="${
          player.name
        }" ><span role="button" class="save-button">💾</span></div>`;
        ({isHost} = player);
      } else {
        playerList += `<div class="player-list-row"><img class="character-change-icon" style="background-color: ${
          player.color
        }" src="${getSrcFromCharacterName(player.character)}" />${player.name}${player.isHost ? '*' : ''}</div>`;
      }
    });
    if (players.length === 1 && !warned) {
      playerList += '<p class="helper-text">Ask some friends to join.</p>';
    }
    playerList += '</div>';

    playerLobbyList.innerHTML = playerList;
    if (isHost && startGameButton) {
      startGameButton.classList.add('visible');
      startGameButton.ontouchend = handleStartGame;
    }
    const input = document.getElementById('name-change-input');
    if (input) {
      input.onchange = (event: Event): void => {
        const newName = (event?.target as HTMLInputElement)?.value;
        nameChange(newName);
      };
    }

    const characterIcon = document.getElementById('character-change-icon');
    const characterChevron = document.getElementById('character-change-chevron');
    if (characterIcon && characterChevron) {
      const callback = (): void => {
        const newImage = changeToNextCharacter((characterIcon as HTMLImageElement).src);
        (characterIcon as HTMLImageElement).src = newImage;
      };
      characterIcon.ontouchend = callback;
      characterChevron.ontouchend = callback;
    }
  }
  globalThis.socket.off(Messages.GameClosed);
  globalThis.socket.on(Messages.GameClosed, (gameId: string): void => {
    if (globalThis.currentGameId === gameId) {
      leaveGame();
    }
  });

  globalThis.socket.off(Messages.GameStarted);
  globalThis.socket.on(Messages.GameStarted, (gameId: string, game: Game): void => {
    if (globalThis.currentGameId === gameId) {
      startGame(game);
    }
  });

  globalThis.socket.off(Messages.CharacterChanged);
  globalThis.socket.on(Messages.CharacterChanged, (gameId: string, newPlayers: Player[]): void => {
    if (globalThis.currentGameId === gameId) {
      populatePlayerList(newPlayers);
    }
  });

  globalThis.socket.off(Messages.NameChanged);
  globalThis.socket.on(Messages.NameChanged, (gameId: string, newPlayers: Player[]): void => {
    if (globalThis.currentGameId === gameId) {
      populatePlayerList(newPlayers);
    }
  });
}
