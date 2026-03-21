import { describe, it, expect } from 'vitest'
import { reconcileScrollback } from '../reconcileScrollback.ts'

describe('reconcileScrollback', () => {
  describe('initial hydration (empty buffer)', () => {
    it('writes full scrollback when buffer is empty', () => {
      const result = reconcileScrollback('A\r\nB\r\n', '')
      expect(result).toEqual({ action: 'write-full', data: 'A\r\nB\r\n' })
    })

    it('writes full even for single-line scrollback', () => {
      const result = reconcileScrollback('hello', '')
      expect(result).toEqual({ action: 'write-full', data: 'hello' })
    })
  })

  describe('identical buffer (no new output)', () => {
    it('skips when scrollback matches buffer exactly', () => {
      const buffer = 'A\r\nB\r\n'
      const result = reconcileScrollback(buffer, buffer)
      expect(result).toEqual({ action: 'skip', data: '' })
    })

    it('skips for empty incoming and empty buffer', () => {
      const result = reconcileScrollback('', '')
      // Empty buffer → write-full with empty string (initial hydration path)
      // This is technically an edge case but empty incoming is unlikely from server
      expect(result).toEqual({ action: 'write-full', data: '' })
    })
  })

  describe('prefix match (append delta)', () => {
    it('appends only the new suffix when server has more output', () => {
      const buffer = 'A\r\n'
      const incoming = 'A\r\nB\r\n'
      const result = reconcileScrollback(incoming, buffer)
      expect(result).toEqual({ action: 'write-delta', data: 'B\r\n' })
    })

    it('handles the concrete reconnect scenario from the spec', () => {
      // User typed commands producing "A\n", then output "B\n" arrived,
      // disconnect happened, server advanced to "A\nB\nC\n"
      const buffer = 'A\nB\n'
      const incoming = 'A\nB\nC\n'
      const result = reconcileScrollback(incoming, buffer)
      expect(result).toEqual({ action: 'write-delta', data: 'C\n' })
    })

    it('appends multi-line delta correctly', () => {
      const buffer = 'line1\r\n'
      const incoming = 'line1\r\nline2\r\nline3\r\n'
      const result = reconcileScrollback(incoming, buffer)
      expect(result).toEqual({
        action: 'write-delta',
        data: 'line2\r\nline3\r\n',
      })
    })
  })

  describe('divergence (reset and rewrite)', () => {
    it('resets when incoming does not start with current buffer', () => {
      const buffer = 'X\r\nY\r\n'
      const incoming = 'A\r\nB\r\n'
      const result = reconcileScrollback(incoming, buffer)
      expect(result).toEqual({ action: 'reset-and-write', data: 'A\r\nB\r\n' })
    })

    it('resets when buffer is longer than incoming', () => {
      const buffer = 'A\r\nB\r\nC\r\n'
      const incoming = 'A\r\n'
      const result = reconcileScrollback(incoming, buffer)
      expect(result).toEqual({ action: 'reset-and-write', data: 'A\r\n' })
    })

    it('resets when buffer has partial overlap but is not a prefix', () => {
      const buffer = 'A\r\nB\r\n'
      const incoming = 'A\r\nZ\r\n'
      const result = reconcileScrollback(incoming, buffer)
      expect(result).toEqual({ action: 'reset-and-write', data: 'A\r\nZ\r\n' })
    })
  })

  describe('exit banner isolation', () => {
    it('UI text appended to buffer causes divergence reset (by design)', () => {
      // If [Process exited] were accidentally appended to serverBuffer,
      // the next scrollback would diverge and force a reset.
      // This test documents why we must NOT pollute serverBufferRef with UI text.
      const bufferWithBanner = 'A\r\n\r\n\x1b[2m[Process exited]\x1b[0m\r\n'
      const incoming = 'A\r\n'
      const result = reconcileScrollback(incoming, bufferWithBanner)
      expect(result).toEqual({ action: 'reset-and-write', data: 'A\r\n' })
    })

    it('clean buffer without banner produces skip on identical reconnect', () => {
      // When serverBufferRef correctly excludes UI text, identical
      // scrollback on reconnect is a no-op — no flicker.
      const cleanBuffer = 'A\r\n'
      const incoming = 'A\r\n'
      const result = reconcileScrollback(incoming, cleanBuffer)
      expect(result).toEqual({ action: 'skip', data: '' })
    })
  })
})
