export function isDebug(additionalRequiredFlag?: string): boolean {
  const url = new URL(window.location.href);
  const debug = url.searchParams.get('debug');
  const hasNeededFlag = !additionalRequiredFlag || url.searchParams.get(additionalRequiredFlag) !== null;
  return debug !== null && hasNeededFlag;
}
