import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { sessionKeys } from '../useSessions.ts'

// Mock the sessions API module
vi.mock('@/api/sessions.ts', () => ({
  listSessions: vi.fn(),
  getSession: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
}))

// Import after mock so we get mocked versions
import * as sessionsApi from '@/api/sessions.ts'
import { useSessions, useSession, useCreateSession, useDeleteSession } from '../useSessions.ts'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

const mockSessions = [
  { id: 's1', name: 'Session 1', cwd: '/tmp', status: 'active' as const, pid: 1234, createdAt: Date.now() },
  { id: 's2', name: 'Session 2', cwd: '/home', status: 'done' as const, pid: null, createdAt: Date.now() },
]

const mockDetail = {
  ...mockSessions[0],
  scrollback: ['line1', 'line2'],
}

describe('sessionKeys', () => {
  describe('all', () => {
    it('returns the base sessions key', () => {
      expect(sessionKeys.all).toEqual(['sessions'])
    })

    it('is a readonly tuple', () => {
      // Type check: the key should be readonly
      const key = sessionKeys.all
      expect(key).toHaveLength(1)
      expect(key[0]).toBe('sessions')
    })
  })

  describe('detail', () => {
    it('returns a key with the session id', () => {
      expect(sessionKeys.detail('abc')).toEqual(['sessions', 'abc'])
    })

    it('produces unique keys for different ids', () => {
      const key1 = sessionKeys.detail('a')
      const key2 = sessionKeys.detail('b')
      expect(key1).not.toEqual(key2)
    })
  })

  describe('scrollback', () => {
    it('returns a key with session id and scrollback suffix', () => {
      expect(sessionKeys.scrollback('abc')).toEqual(['sessions', 'abc', 'scrollback'])
    })

    it('extends the detail key', () => {
      const detailKey = sessionKeys.detail('x')
      const scrollbackKey = sessionKeys.scrollback('x')
      expect(scrollbackKey.slice(0, 2)).toEqual(detailKey)
      expect(scrollbackKey[2]).toBe('scrollback')
    })
  })
})

describe('useSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches and returns session data', async () => {
    vi.mocked(sessionsApi.listSessions).mockResolvedValue(mockSessions)

    const { result } = renderHook(() => useSessions(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockSessions)
    expect(sessionsApi.listSessions).toHaveBeenCalledOnce()
  })

  it('handles API errors', async () => {
    vi.mocked(sessionsApi.listSessions).mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useSessions(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeInstanceOf(Error)
  })
})

describe('useSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches a single session by id', async () => {
    vi.mocked(sessionsApi.getSession).mockResolvedValue(mockDetail)

    const { result } = renderHook(() => useSession('s1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockDetail)
    expect(sessionsApi.getSession).toHaveBeenCalledWith('s1')
  })

  it('does not fetch when id is null', () => {
    const { result } = renderHook(() => useSession(null), {
      wrapper: createWrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(sessionsApi.getSession).not.toHaveBeenCalled()
  })
})

describe('useCreateSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls createSession API on mutate', async () => {
    const newSession = { id: 's3', name: 'New', cwd: '/tmp', status: 'active' as const, pid: 5678, createdAt: Date.now() }
    vi.mocked(sessionsApi.createSession).mockResolvedValue(newSession)

    const { result } = renderHook(() => useCreateSession(), {
      wrapper: createWrapper(),
    })

    result.current.mutate({ name: 'New', cwd: '/tmp' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(sessionsApi.createSession).toHaveBeenCalledWith({ name: 'New', cwd: '/tmp' })
  })
})

describe('useDeleteSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls deleteSession API on mutate', async () => {
    vi.mocked(sessionsApi.deleteSession).mockResolvedValue(undefined)

    const { result } = renderHook(() => useDeleteSession(), {
      wrapper: createWrapper(),
    })

    result.current.mutate('s1')

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(sessionsApi.deleteSession).toHaveBeenCalledWith('s1')
  })
})
