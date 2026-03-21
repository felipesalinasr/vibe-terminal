/**
 * Reconciles a full server scrollback snapshot against the terminal's
 * locally-tracked server buffer to determine what to write to xterm.
 *
 * This runs in the rendering layer (XtermTerminal), not the transport
 * layer (useTerminalWS), keeping the two concerns separated.
 */

export interface ReconcileResult {
  /** What the terminal should do with the incoming scrollback. */
  action: 'write-full' | 'write-delta' | 'reset-and-write' | 'skip'
  /** The data to write (empty string for 'skip'). */
  data: string
}

export function reconcileScrollback(
  incoming: string,
  currentBuffer: string,
): ReconcileResult {
  // Initial hydration — buffer is empty, write everything
  if (currentBuffer === '') {
    return { action: 'write-full', data: incoming }
  }

  // Identical — nothing new, skip the write entirely
  if (incoming === currentBuffer) {
    return { action: 'skip', data: '' }
  }

  // Server snapshot is a superset of what we've seen — write only the delta
  if (incoming.startsWith(currentBuffer)) {
    return { action: 'write-delta', data: incoming.slice(currentBuffer.length) }
  }

  // Divergence — local buffer no longer matches server.
  // Safest recovery: clear terminal and replay the full server snapshot.
  return { action: 'reset-and-write', data: incoming }
}
