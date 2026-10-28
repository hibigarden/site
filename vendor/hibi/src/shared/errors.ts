/** Strip Electron's transport wrappers before showing a failure to the user. */
export function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(
    /^(?:Error:\s*|Error invoking remote method ['"][^'"]+['"]:\s*)+/,
    '',
  )
}
