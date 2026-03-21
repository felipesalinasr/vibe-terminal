import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { TerminalInboundMessage, TerminalOutboundMessage } from '@/types/ws.ts'
import type { SessionSummary } from '@/types/session.ts'
import { sessionKeys } from '@/hooks/useSessions.ts'
import { agentKeys } from '@/hooks/useAgentConfig.ts'
import { getScrollback } from '@/api/sessions.ts'

export type TerminalWSState =
  | 'disconnected'
  | 'connecting'
  | 'hydrating'
  | 'ready'
  | 'historical'
  | 'exited'
  | 'error'

type MessageHandler = (msg: TerminalInboundMessage) => void

interface UseTerminalWSOptions {
  sessionId: string | null
  enabled: boolean
}

interface UseTerminalWSReturn {
  state: TerminalWSState
  send: (msg: TerminalOutboundMessage) => void
  onMessage: (handler: MessageHandler) => () => void
}

const MAX_RETRIES = 3
const BACKOFF_DELAYS = [1000, 2000, 4000]

export function useTerminalWS({
  sessionId,
  enabled,
}: UseTerminalWSOptions): UseTerminalWSReturn {
  const [state, setState] = useState<TerminalWSState>('disconnected')
  const wsRef = useRef<WebSocket | null>(null)
  const handlersRef = useRef<Set<MessageHandler>>(new Set())
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasReceivedScrollbackRef = useRef(false)
  const sessionIdRef = useRef(sessionId)
  const enabledRef = useRef(enabled)
  const stateRef = useRef<TerminalWSState>('disconnected')

  const queryClient = useQueryClient()

  // Keep refs in sync
  sessionIdRef.current = sessionId
  enabledRef.current = enabled

  const setStateAndRef = (next: TerminalWSState) => {
    stateRef.current = next
    setState(next)
  }

  const broadcast = useCallback((msg: TerminalInboundMessage) => {
    for (const handler of handlersRef.current) {
      handler(msg)
    }
  }, [])

  const send = useCallback((msg: TerminalOutboundMessage) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }, [])

  const onMessage = useCallback((handler: MessageHandler): (() => void) => {
    handlersRef.current.add(handler)
    return () => {
      handlersRef.current.delete(handler)
    }
  }, [])

  const cleanup = useCallback(() => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.onopen = null
      wsRef.current.onmessage = null
      wsRef.current.onclose = null
      wsRef.current.onerror = null
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const recoverViaHTTP = useCallback(async (sid: string) => {
    try {
      const response = await getScrollback(sid)
      if (response.data) {
        broadcast({ type: 'scrollback', data: response.data })
      }
    } catch {
      // Recovery failed silently -- terminal may be stale
    }
  }, [broadcast])

  const connect = useCallback((sid: string) => {
    cleanup()
    setStateAndRef('connecting')
    hasReceivedScrollbackRef.current = false

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${location.host}/ws?sessionId=${sid}`)
    wsRef.current = ws

    ws.onopen = () => {
      retryCountRef.current = 0
      // Stay in 'connecting' until scrollback arrives
    }

    ws.onmessage = (event: MessageEvent) => {
      let msg: TerminalInboundMessage
      try {
        msg = JSON.parse(event.data as string) as TerminalInboundMessage
      } catch {
        return
      }

      switch (msg.type) {
        case 'scrollback': {
          if (!hasReceivedScrollbackRef.current) {
            hasReceivedScrollbackRef.current = true
            setStateAndRef('hydrating')
          }
          broadcast(msg)
          // Transition to ready after hydration
          setStateAndRef('ready')
          break
        }

        case 'output': {
          broadcast(msg)
          break
        }

        case 'state': {
          // Update session status in React Query cache
          queryClient.setQueryData<SessionSummary[]>(
            sessionKeys.all,
            (old) => {
              if (!old) return old
              return old.map((s) =>
                s.id === sid ? { ...s, status: msg.state as SessionSummary['status'] } : s,
              )
            },
          )
          broadcast(msg)
          break
        }

        case 'file': {
          broadcast(msg)
          break
        }

        case 'skills-changed': {
          queryClient.invalidateQueries({ queryKey: agentKeys.skills(sid) })
          queryClient.invalidateQueries({ queryKey: agentKeys.config(sid) })
          broadcast(msg)
          break
        }

        case 'historical': {
          setStateAndRef('historical')
          broadcast(msg)
          break
        }

        case 'exit': {
          setStateAndRef('exited')
          broadcast(msg)
          break
        }
      }
    }

    ws.onclose = () => {
      wsRef.current = null

      // Don't reconnect if session is historical or exited
      const currentState = stateRef.current
      if (
        currentState === 'historical' ||
        currentState === 'exited' ||
        !enabledRef.current ||
        sessionIdRef.current !== sid
      ) {
        if (currentState !== 'historical' && currentState !== 'exited') {
          setStateAndRef('disconnected')
        }
        return
      }

      // Auto-reconnect for live sessions
      if (retryCountRef.current < MAX_RETRIES) {
        const delay = BACKOFF_DELAYS[retryCountRef.current] ?? 4000
        retryCountRef.current++
        setStateAndRef('connecting')
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null
          if (enabledRef.current && sessionIdRef.current === sid) {
            // Recover scrollback via HTTP before reconnecting
            void recoverViaHTTP(sid).then(() => {
              if (enabledRef.current && sessionIdRef.current === sid) {
                connect(sid)
              }
            })
          }
        }, delay)
      } else {
        setStateAndRef('error')
      }
    }

    ws.onerror = () => {
      // onerror is always followed by onclose, so let onclose handle state
    }
  }, [broadcast, cleanup, queryClient, recoverViaHTTP])

  // Main effect: connect/disconnect based on sessionId + enabled
  useEffect(() => {
    if (enabled && sessionId) {
      retryCountRef.current = 0
      connect(sessionId)
    } else {
      cleanup()
      setStateAndRef('disconnected')
    }

    return () => {
      cleanup()
      setStateAndRef('disconnected')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, enabled])

  return { state, send, onMessage }
}
