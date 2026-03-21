import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ---- Mock WebSocket ----

type WSListener = ((event: { data: string }) => void) | null

class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  // Instance constants matching the WebSocket spec
  readonly CONNECTING = 0
  readonly OPEN = 1
  readonly CLOSING = 2
  readonly CLOSED = 3

  url: string
  readyState: number = MockWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onmessage: WSListener = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null

  send = vi.fn()
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED
  })

  constructor(url: string) {
    this.url = url
    MockWebSocket._instances.push(this)
  }

  // Test helpers
  static _instances: MockWebSocket[] = []
  static _reset() {
    MockWebSocket._instances = []
  }
  static _latest(): MockWebSocket {
    return MockWebSocket._instances[MockWebSocket._instances.length - 1]
  }

  _simulateOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.()
  }

  _simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) })
  }

  _simulateClose() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.()
  }

  _simulateError() {
    this.onerror?.()
  }
}

// Stub global WebSocket
vi.stubGlobal('WebSocket', MockWebSocket)

// Mock useAgentConfig to avoid import issues
vi.mock('@/hooks/useAgentConfig.ts', () => ({
  agentKeys: {
    config: (id: string) => ['agent', id] as const,
    skills: (id: string) => ['agent', id, 'skills'] as const,
  },
}))

// Import after mocks are set up
import { useTerminalWS } from '../useTerminalWS.ts'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useTerminalWS', () => {
  beforeEach(() => {
    MockWebSocket._reset()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('starts as disconnected when not enabled', () => {
      const { result } = renderHook(
        () => useTerminalWS({ sessionId: null, enabled: false }),
        { wrapper: createWrapper() },
      )
      expect(result.current.state).toBe('disconnected')
    })

    it('starts as disconnected when sessionId is null', () => {
      const { result } = renderHook(
        () => useTerminalWS({ sessionId: null, enabled: true }),
        { wrapper: createWrapper() },
      )
      expect(result.current.state).toBe('disconnected')
    })
  })

  describe('connection lifecycle', () => {
    it('transitions to connecting when enabled with a sessionId', () => {
      const { result } = renderHook(
        () => useTerminalWS({ sessionId: 'sess-1', enabled: true }),
        { wrapper: createWrapper() },
      )
      expect(result.current.state).toBe('connecting')
      expect(MockWebSocket._instances).toHaveLength(1)
    })

    it('creates WebSocket with correct URL', () => {
      renderHook(
        () => useTerminalWS({ sessionId: 'sess-1', enabled: true }),
        { wrapper: createWrapper() },
      )
      const ws = MockWebSocket._latest()
      expect(ws.url).toContain('sessionId=sess-1')
    })
  })

  describe('fresh session (no scrollback)', () => {
    it('transitions connecting -> ready on state message without prior scrollback', () => {
      const { result } = renderHook(
        () => useTerminalWS({ sessionId: 'sess-1', enabled: true }),
        { wrapper: createWrapper() },
      )

      const ws = MockWebSocket._latest()

      act(() => {
        ws._simulateOpen()
      })

      // Still connecting - no scrollback or state message yet
      expect(result.current.state).toBe('connecting')

      // Receive a state message without prior scrollback
      act(() => {
        ws._simulateMessage({ type: 'state', state: 'active' })
      })

      expect(result.current.state).toBe('ready')
    })
  })

  describe('session with scrollback', () => {
    it('transitions connecting -> hydrating -> ready on scrollback message', () => {
      const { result } = renderHook(
        () => useTerminalWS({ sessionId: 'sess-1', enabled: true }),
        { wrapper: createWrapper() },
      )

      const ws = MockWebSocket._latest()
      act(() => ws._simulateOpen())

      act(() => {
        ws._simulateMessage({ type: 'scrollback', data: 'history line 1\r\n' })
      })

      // After scrollback, should be ready
      expect(result.current.state).toBe('ready')
    })
  })

  describe('reconnect delivers scrollback', () => {
    it('reaches ready and delivers scrollback message to handlers on reconnect', () => {
      const handler = vi.fn()
      const { result } = renderHook(
        ({ sid, enabled }) => useTerminalWS({ sessionId: sid, enabled }),
        {
          wrapper: createWrapper(),
          initialProps: { sid: 'sess-1', enabled: true },
        },
      )

      act(() => {
        result.current.onMessage(handler)
      })

      const ws1 = MockWebSocket._latest()
      act(() => ws1._simulateOpen())
      act(() => {
        ws1._simulateMessage({ type: 'scrollback', data: 'initial' })
      })
      expect(result.current.state).toBe('ready')
      expect(handler).toHaveBeenCalledWith({ type: 'scrollback', data: 'initial' })
      handler.mockClear()

      // Simulate a close which triggers reconnect
      act(() => ws1._simulateClose())
      expect(result.current.state).toBe('connecting')

      // Advance past reconnect delay
      act(() => vi.advanceTimersByTime(1500))

      const ws2 = MockWebSocket._latest()
      expect(ws2).not.toBe(ws1)
      act(() => ws2._simulateOpen())

      // Reconnect receives scrollback — must be delivered (not suppressed)
      act(() => {
        ws2._simulateMessage({ type: 'scrollback', data: 'initial plus new' })
      })

      expect(result.current.state).toBe('ready')
      // The scrollback message must reach the handler so the terminal can reconcile
      expect(handler).toHaveBeenCalledWith({ type: 'scrollback', data: 'initial plus new' })
    })

    it('skips hydrating state on reconnect scrollback', () => {
      const stateLog: string[] = []

      const { result } = renderHook(
        ({ sid, enabled }) => {
          const hook = useTerminalWS({ sessionId: sid, enabled })
          stateLog.push(hook.state)
          return hook
        },
        {
          wrapper: createWrapper(),
          initialProps: { sid: 'sess-1', enabled: true },
        },
      )

      const ws1 = MockWebSocket._latest()
      act(() => ws1._simulateOpen())
      act(() => ws1._simulateMessage({ type: 'scrollback', data: 'x' }))

      // Clear log before reconnect
      stateLog.length = 0

      act(() => ws1._simulateClose())
      act(() => vi.advanceTimersByTime(1500))

      const ws2 = MockWebSocket._latest()
      act(() => ws2._simulateOpen())
      act(() => ws2._simulateMessage({ type: 'scrollback', data: 'x' }))

      expect(result.current.state).toBe('ready')
      // Should NOT have passed through 'hydrating' during reconnect
      expect(stateLog).not.toContain('hydrating')
    })
  })

  describe('historical session', () => {
    it('transitions to historical on historical message', () => {
      const { result } = renderHook(
        () => useTerminalWS({ sessionId: 'sess-1', enabled: true }),
        { wrapper: createWrapper() },
      )

      const ws = MockWebSocket._latest()
      act(() => ws._simulateOpen())

      act(() => {
        ws._simulateMessage({ type: 'historical' })
      })

      expect(result.current.state).toBe('historical')
    })
  })

  describe('exited session', () => {
    it('transitions to exited on exit message', () => {
      const { result } = renderHook(
        () => useTerminalWS({ sessionId: 'sess-1', enabled: true }),
        { wrapper: createWrapper() },
      )

      const ws = MockWebSocket._latest()
      act(() => ws._simulateOpen())

      act(() => {
        ws._simulateMessage({ type: 'exit' })
      })

      expect(result.current.state).toBe('exited')
    })
  })

  describe('onMessage', () => {
    it('broadcasts messages to registered handlers', () => {
      const handler = vi.fn()

      const { result } = renderHook(
        () => useTerminalWS({ sessionId: 'sess-1', enabled: true }),
        { wrapper: createWrapper() },
      )

      // Register handler
      act(() => {
        result.current.onMessage(handler)
      })

      const ws = MockWebSocket._latest()
      act(() => ws._simulateOpen())

      act(() => {
        ws._simulateMessage({ type: 'output', data: 'hello world' })
      })

      expect(handler).toHaveBeenCalledWith({ type: 'output', data: 'hello world' })
    })

    it('supports multiple handlers', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      const { result } = renderHook(
        () => useTerminalWS({ sessionId: 'sess-1', enabled: true }),
        { wrapper: createWrapper() },
      )

      act(() => {
        result.current.onMessage(handler1)
        result.current.onMessage(handler2)
      })

      const ws = MockWebSocket._latest()
      act(() => ws._simulateOpen())

      act(() => {
        ws._simulateMessage({ type: 'output', data: 'data' })
      })

      expect(handler1).toHaveBeenCalledOnce()
      expect(handler2).toHaveBeenCalledOnce()
    })

    it('returns an unsubscribe function', () => {
      const handler = vi.fn()

      const { result } = renderHook(
        () => useTerminalWS({ sessionId: 'sess-1', enabled: true }),
        { wrapper: createWrapper() },
      )

      let unsub: () => void
      act(() => {
        unsub = result.current.onMessage(handler)
      })

      const ws = MockWebSocket._latest()
      act(() => ws._simulateOpen())

      // Unsubscribe before message
      act(() => unsub())

      act(() => {
        ws._simulateMessage({ type: 'output', data: 'ignored' })
      })

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('send', () => {
    it('sends JSON when WebSocket is open', () => {
      const { result } = renderHook(
        () => useTerminalWS({ sessionId: 'sess-1', enabled: true }),
        { wrapper: createWrapper() },
      )

      const ws = MockWebSocket._latest()
      act(() => ws._simulateOpen())

      act(() => {
        result.current.send({ type: 'input', data: 'ls -la\n' })
      })

      expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'input', data: 'ls -la\n' }))
    })

    it('does not send when WebSocket is not open', () => {
      const { result } = renderHook(
        () => useTerminalWS({ sessionId: 'sess-1', enabled: true }),
        { wrapper: createWrapper() },
      )

      const ws = MockWebSocket._latest()
      // Don't open the connection

      act(() => {
        result.current.send({ type: 'input', data: 'test' })
      })

      expect(ws.send).not.toHaveBeenCalled()
    })

    it('does not send when disconnected', () => {
      const { result } = renderHook(
        () => useTerminalWS({ sessionId: null, enabled: false }),
        { wrapper: createWrapper() },
      )

      act(() => {
        result.current.send({ type: 'input', data: 'test' })
      })

      // No WebSocket instances created
      expect(MockWebSocket._instances).toHaveLength(0)
    })
  })

  describe('cleanup', () => {
    it('closes WebSocket and goes to disconnected when disabled', () => {
      const { rerender } = renderHook(
        ({ enabled }) => useTerminalWS({ sessionId: 'sess-1', enabled }),
        {
          wrapper: createWrapper(),
          initialProps: { enabled: true },
        },
      )

      const ws = MockWebSocket._latest()
      act(() => ws._simulateOpen())

      rerender({ enabled: false })

      expect(ws.close).toHaveBeenCalled()
    })

    it('closes WebSocket on unmount', () => {
      const { unmount } = renderHook(
        () => useTerminalWS({ sessionId: 'sess-1', enabled: true }),
        { wrapper: createWrapper() },
      )

      const ws = MockWebSocket._latest()
      act(() => ws._simulateOpen())

      unmount()

      expect(ws.close).toHaveBeenCalled()
    })
  })

  describe('does not reconnect after historical/exited', () => {
    it('does not reconnect after historical', () => {
      const { result } = renderHook(
        () => useTerminalWS({ sessionId: 'sess-1', enabled: true }),
        { wrapper: createWrapper() },
      )

      const ws = MockWebSocket._latest()
      act(() => ws._simulateOpen())
      act(() => ws._simulateMessage({ type: 'historical' }))

      expect(result.current.state).toBe('historical')

      // Simulate close - should not trigger reconnect
      act(() => ws._simulateClose())

      // State should remain historical, not go to connecting
      expect(result.current.state).toBe('historical')

      // No reconnect timer should fire
      act(() => vi.advanceTimersByTime(5000))
      expect(result.current.state).toBe('historical')
    })

    it('does not reconnect after exit', () => {
      const { result } = renderHook(
        () => useTerminalWS({ sessionId: 'sess-1', enabled: true }),
        { wrapper: createWrapper() },
      )

      const ws = MockWebSocket._latest()
      act(() => ws._simulateOpen())
      act(() => ws._simulateMessage({ type: 'exit' }))

      expect(result.current.state).toBe('exited')

      act(() => ws._simulateClose())

      expect(result.current.state).toBe('exited')
    })
  })
})
