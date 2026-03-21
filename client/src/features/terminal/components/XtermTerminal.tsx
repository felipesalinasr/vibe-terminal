import { useCallback, useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useTerminalWS } from '../hooks/useTerminalWS.ts'
import { reconcileScrollback } from '../reconcileScrollback.ts'
import type { TerminalInboundMessage } from '@/types/ws.ts'
import { dropFile } from '@/api/files.ts'
import { ToastContainer } from './ToastContainer.tsx'
import { HistoricalBar } from './HistoricalBar.tsx'
import styles from './XtermTerminal.module.css'

interface XtermTerminalProps {
  sessionId: string
}

const XTERM_THEME = {
  background: '#0a0c10',
  foreground: '#f2f2f2',
  cursor: '#33ff00',
  cursorAccent: '#0a0c10',
  selectionBackground: '#33ff0040',
  black: '#0a0c10',
  red: '#ff5c57',
  green: '#33ff00',
  yellow: '#f5bf4f',
  blue: '#00d4ff',
  magenta: '#c792ea',
  cyan: '#00d4ff',
  white: '#e0e4ef',
  brightBlack: '#505868',
  brightRed: '#ff5c57',
  brightGreen: '#33ff00',
  brightYellow: '#f5bf4f',
  brightBlue: '#00d4ff',
  brightMagenta: '#c792ea',
  brightCyan: '#00d4ff',
  brightWhite: '#f2f2f2',
}

export function XtermTerminal({ sessionId }: XtermTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalElRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const dropCounterRef = useRef(0)

  // Tracks only server-provided terminal bytes (scrollback + output).
  // UI-only text like [Process exited] is NOT appended here so it
  // doesn't pollute reconciliation comparisons on reconnect.
  const serverBufferRef = useRef('')

  const [dropActive, setDropActive] = useState(false)
  const [filePaths, setFilePaths] = useState<string[]>([])
  const [showHistorical, setShowHistorical] = useState(false)

  const { state, send, onMessage } = useTerminalWS({
    sessionId,
    enabled: true,
  })

  // Reset per-session state when sessionId changes.
  // State values use render-time adjustment; ref resets go in an effect.
  const [prevSessionId, setPrevSessionId] = useState(sessionId)
  if (sessionId !== prevSessionId) {
    setPrevSessionId(sessionId)
    setShowHistorical(false)
    setFilePaths([])
  }
  useEffect(() => {
    serverBufferRef.current = ''
  }, [sessionId])

  // Initialize xterm.js on mount
  useEffect(() => {
    const el = terminalElRef.current
    if (!el) return

    const term = new Terminal({
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: 13,
      lineHeight: 1.3,
      theme: XTERM_THEME,
      cursorBlink: true,
      scrollback: 10000,
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(el)

    termRef.current = term
    fitAddonRef.current = fitAddon

    // Initial fit after DOM layout
    requestAnimationFrame(() => {
      fitAddon.fit()
    })

    // ResizeObserver for responsive resize
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        try {
          fitAddon.fit()
        } catch {
          // Terminal might be disposed during resize
        }
      })
    })
    observer.observe(el)

    return () => {
      observer.disconnect()
      fitAddon.dispose()
      term.dispose()
      termRef.current = null
      fitAddonRef.current = null
    }
  }, [])

  // Wire term.onData -> send outbound input
  useEffect(() => {
    const term = termRef.current
    if (!term) return

    const disposable = term.onData((data) => {
      send({ type: 'input', data })
    })

    return () => {
      disposable.dispose()
    }
  }, [send])

  // Wire term.onResize -> send outbound resize
  useEffect(() => {
    const term = termRef.current
    if (!term) return

    const disposable = term.onResize(({ cols, rows }) => {
      send({ type: 'resize', cols, rows })
    })

    return () => {
      disposable.dispose()
    }
  }, [send])

  // Handle inbound WS messages
  useEffect(() => {
    const cleanup = onMessage((msg: TerminalInboundMessage) => {
      const term = termRef.current
      if (!term) return

      switch (msg.type) {
        case 'output': {
          term.write(msg.data)
          serverBufferRef.current += msg.data
          break
        }

        case 'scrollback': {
          // Server sends full scrollback snapshot on every WS connect.
          // Reconcile against what we've already rendered to avoid
          // duplicating content while still recovering missed output.
          const result = reconcileScrollback(msg.data, serverBufferRef.current)
          switch (result.action) {
            case 'write-full':
              term.write(result.data)
              break
            case 'write-delta':
              term.write(result.data)
              break
            case 'reset-and-write':
              term.reset()
              term.write(result.data)
              break
            case 'skip':
              break
          }
          serverBufferRef.current = msg.data
          break
        }

        case 'historical': {
          term.options.disableStdin = true
          setShowHistorical(true)
          break
        }

        case 'exit': {
          // Write banner to terminal but NOT to serverBufferRef —
          // this is UI-only text that must not affect reconciliation.
          term.write('\r\n\x1b[2m[Process exited]\x1b[0m\r\n')
          break
        }

        case 'file': {
          setFilePaths((prev) => [...prev, msg.path])
          break
        }

        // state and skills-changed are handled by useTerminalWS internally
        default:
          break
      }
    })

    return cleanup
  }, [onMessage])

  // Focus terminal when ready
  useEffect(() => {
    if (state === 'ready') {
      termRef.current?.focus()
    }
  }, [state])

  // Re-fit when state transitions (terminal may have been resized while connecting)
  useEffect(() => {
    if (state === 'ready' || state === 'historical') {
      requestAnimationFrame(() => {
        try {
          fitAddonRef.current?.fit()
        } catch {
          // Ignore
        }
      })
    }
  }, [state])

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dropCounterRef.current++
    setDropActive(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    dropCounterRef.current--
    if (dropCounterRef.current <= 0) {
      dropCounterRef.current = 0
      setDropActive(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      dropCounterRef.current = 0
      setDropActive(false)

      const files = Array.from(e.dataTransfer.files)
      if (files.length === 0) return

      const paths: string[] = []
      for (const file of files) {
        try {
          const result = await dropFile(file)
          if (result.path) {
            // Escape special shell characters in path
            const escaped = result.path.replace(
              /([ '"\\()&;|<>$`!#])/g,
              '\\$1',
            )
            paths.push(escaped)
          }
        } catch {
          // Drop upload failed silently
        }
      }

      if (paths.length > 0) {
        send({ type: 'input', data: paths.join(' ') })
      }
    },
    [send],
  )

  const handleDismissToast = useCallback((path: string) => {
    setFilePaths((prev) => prev.filter((p) => p !== path))
  }, [])

  const containerClassName = [
    styles.container,
    dropActive ? styles.dropActive : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <div
        ref={containerRef}
        className={containerClassName}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div ref={terminalElRef} className={styles.terminalInner} />

        {state === 'connecting' && (
          <div className={styles.connecting}>Connecting...</div>
        )}
        {state === 'error' && (
          <div className={styles.error}>Connection lost</div>
        )}

        <ToastContainer
          filePaths={filePaths}
          onDismiss={handleDismissToast}
        />
      </div>

      {showHistorical && <HistoricalBar sessionId={sessionId} />}
    </>
  )
}
