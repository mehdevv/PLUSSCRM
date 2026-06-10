export function repHasPipelinePrevious(repId: string | undefined, previousRepIds: string[]): boolean {
  if (!repId) return false;
  return previousRepIds.includes(repId);
}
