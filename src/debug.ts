export function isDebug(additionalRequiredFlag?: string): boolean {
  const url = new URL(window.location.href);
  const debug = url.searchParams.get('debug');
  const hasNeededFlag = !additionalRequiredFlag || url.searchParams.get(additionalRequiredFlag) !== null;
  return debug !== null && hasNeededFlag;
}

export function getServerPort(): string {
  return new URL(window.location.href).port.replace('080', '081');
}
