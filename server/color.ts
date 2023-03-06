import {getRandomInt} from './data';

interface RGB {
  b: number;
  g: number;
  r: number;
}

function rgbToYIQ({r, g, b}: RGB): number {
  return (r * 299 + g * 587 + b * 114) / 1000;
}
function hexToRgb(hex: string): RGB | undefined {
  if (!hex || hex === undefined || hex === '') {
    return undefined;
  }

  const result: RegExpExecArray | null = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    };
  }

  return undefined;
}

export function contrast(colorHex: string | undefined, threshold = 128): string {
  if (colorHex === undefined) {
    return '#000';
  }

  const rgb: RGB | undefined = hexToRgb(colorHex);

  if (rgb === undefined) {
    return '#000';
  }

  return rgbToYIQ(rgb) >= threshold ? '#000' : '#fff';
}

export function getRandomColor(): string {
  const h = getRandomInt(0, 360);
  const s = getRandomInt(42, 98);
  const l = getRandomInt(40, 90);
  return `hsl(${h},${s}%,${l}%)`;
}
