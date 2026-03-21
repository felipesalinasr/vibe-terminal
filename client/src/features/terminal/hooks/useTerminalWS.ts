import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { TerminalInboundMessage, TerminalOutboundMessage } from '@/types/ws.ts'
import type { SessionSummary, SessionDetail } from '@/types/session.ts'
import { sessionKeys } from '@/hooks/useSessions.ts'
import { agentKeys } from '@/hooks/useAgentConfig.ts'

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
  const isReconnectRef = useRef(false)
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

  const updateSessionCache = useCallback(
    (sid: string, status: string) => {
      // Fix #25: update both list cache AND detail cache
      queryClient.setQueryData<SessionSummary[]>(
        sessionKeys.all,
        (old) => {
          if (!old) return old
          return old.map((s) =>
            s.id === sid ? { ...s, status: status as SessionSummary['status'] } : s,
          )
        },
      )
      queryClient.setQueryData<SessionDetail>(
        sessionKeys.detail(sid),
        (old) => {
          if (!old) return old
          return { ...old, status: status as SessionDetail['status'] }
        },
      )
    },
    [queryClient],
  )

  const connect = useCallback((sid: string) => {
    cleanup()
    setStateAndRef('connecting')
    hasReceivedScrollbackRef.current = false

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${location.host}/ws?sessionId=${sid}`)
    wsRef.current = ws

    ws.onopen = () => {
      retryCountRef.current = 0
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
          // Fix #23: On reconnect, the terminal already has content.
          // Suppress the server's scrollback to avoid duplication.
          if (isReconnectRef.current) {
            hasReceivedScrollbackRef.current = true
            setStateAndRef('ready')
            break
          }

          if (!hasReceivedScrollbackRef.current) {
            hasReceivedScrollbackRef.current = true
            setStateAndRef('hydrating')
          }
          broadcast(msg)
          setStateAndRef('ready')
          break
        }

        case 'output': {
          broadcast(msg)
          break
        }

        case 'state': {
          // Fix #24: If no scrollback was received and we're still connecting,
          // this means the session has no scrollback (fresh session).
          // Transition to ready so the UI doesn't stay stuck on "Connecting...".
          if (!hasReceivedScrollbackRef.current && stateRef.current === 'connecting') {
            setStateAndRef('ready')
          }
          updateSessionCache(sid, msg.state)
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
          updateSessionCache(sid, 'historical')
          broadcast(msg)
          break
        }

        case 'exit': {
          setStateAndRef('exited')
          updateSessionCache(sid, 'done')
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
            // Fix #23: Mark as reconnect so scrollback is suppressed
            isReconnectRef.current = true
            connect(sid)
          }
        }, delay)
      } else {
        setStateAndRef('error')
      }
    }

    ws.onerror = () => {
      // onerror is always followed by onclose, so let onclose handle state
    }
  }, [broadcast, cleanup, queryClient, updateSessionCache])

  // Main effect: connect/disconnect based on sessionId + enabled
  useEffect(() => {
    if (enabled && sessionId) {
      retryCountRef.current = 0
      isReconnectRef.current = false
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
