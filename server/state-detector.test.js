import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStateDetector } from './state-detector.js';

describe('createStateDetector', () => {
  let onStateChange;
  let onFileDetected;
  let onSkillsChanged;
  let detector;

  beforeEach(() => {
    vi.useFakeTimers();
    onStateChange = vi.fn();
    onFileDetected = vi.fn();
    onSkillsChanged = vi.fn();
    detector = createStateDetector(onStateChange, onFileDetected, onSkillsChanged);
  });

  afterEach(() => {
    detector.destroy();
    vi.useRealTimers();
  });

  describe('state detection', () => {
    it('starts in active state', () => {
      expect(detector.getState()).toBe('active');
    });

    it('detects review state on prompt pattern (y/n)', () => {
      detector.processOutput('Do you want to proceed? (y/n)');
      expect(onStateChange).toHaveBeenCalledWith('review');
    });

    it('detects review state on prompt arrow', () => {
      detector.processOutput('some output\n❯ ');
      expect(onStateChange).toHaveBeenCalledWith('review');
    });

    it('detects review state on Yes/No prompt', () => {
      detector.processOutput('(Y)es (N)o');
      expect(onStateChange).toHaveBeenCalledWith('review');
    });

    it('detects review state on Press Enter', () => {
      detector.processOutput('Press Enter to continue');
      expect(onStateChange).toHaveBeenCalledWith('review');
    });

    it('detects active state on tool call pattern', () => {
      // First go to review, then back to active
      detector.processOutput('(y/n)');
      onStateChange.mockClear();

      detector.processOutput('● Read(/Users/foo/bar.js)');
      expect(onStateChange).toHaveBeenCalledWith('active');
    });

    it('detects active state on Write tool call', () => {
      detector.processOutput('(y/n)');
      onStateChange.mockClear();

      detector.processOutput('● Write(/Users/foo/bar.js)');
      expect(onStateChange).toHaveBeenCalledWith('active');
    });

    it('detects active state on Bash tool call', () => {
      detector.processOutput('(y/n)');
      onStateChange.mockClear();

      detector.processOutput('● Bash(npm test)');
      expect(onStateChange).toHaveBeenCalledWith('active');
    });

    it('detects active state on Thinking', () => {
      detector.processOutput('(y/n)');
      onStateChange.mockClear();

      detector.processOutput('Thinking...');
      expect(onStateChange).toHaveBeenCalledWith('active');
    });

    it('transitions to review after idle timeout', () => {
      detector.processOutput('some output');
      // Initially active
      expect(detector.getState()).toBe('active');

      // Advance past idle timeout (5000ms)
      vi.advanceTimersByTime(5001);

      expect(onStateChange).toHaveBeenCalledWith('review');
      expect(detector.getState()).toBe('review');
    });

    it('does not change state for same state', () => {
      // Already active, feeding active patterns shouldn't fire callback
      detector.processOutput('● Read(foo)');
      // active -> active is a no-op
      expect(onStateChange).not.toHaveBeenCalledWith('active');
    });
  });

  describe('file detection', () => {
    it('detects Write tool file paths', () => {
      detector.processOutput('● Write(/Users/foo/bar.js)');
      expect(onFileDetected).toHaveBeenCalledWith('/Users/foo/bar.js');
    });

    it('detects Edit tool file paths', () => {
      detector.processOutput('● Edit(/Users/foo/bar.js)');
      expect(onFileDetected).toHaveBeenCalledWith('/Users/foo/bar.js');
    });

    it('detects Created file messages', () => {
      detector.processOutput('Created file at: /Users/foo/bar.js');
      expect(onFileDetected).toHaveBeenCalledWith('/Users/foo/bar.js');
    });

    it('does not fire for Read tool calls', () => {
      detector.processOutput('● Read(/Users/foo/bar.js)');
      expect(onFileDetected).not.toHaveBeenCalled();
    });
  });

  describe('skill detection', () => {
    it('triggers skill change after npx skills add', () => {
      detector.processOutput('npx skills add my-skill');
      vi.advanceTimersByTime(5001);
      expect(onSkillsChanged).toHaveBeenCalled();
    });

    it('triggers skill change after Added skill message', () => {
      detector.processOutput('Added skill successfully');
      vi.advanceTimersByTime(5001);
      expect(onSkillsChanged).toHaveBeenCalled();
    });

    it('debounces multiple skill triggers', () => {
      detector.processOutput('npx skills add a');
      detector.processOutput('npx skills add b');
      vi.advanceTimersByTime(5001);
      expect(onSkillsChanged).toHaveBeenCalledTimes(1);
    });
  });

  describe('buffer management', () => {
    it('truncates buffer to prevent memory growth', () => {
      // Feed 5000 chars
      const bigChunk = 'x'.repeat(5000);
      detector.processOutput(bigChunk);
      // Internal buffer should be trimmed (we can verify indirectly by checking no crash)
      expect(detector.getState()).toBe('active');
    });
  });

  describe('destroy', () => {
    it('cleans up timers without errors', () => {
      detector.processOutput('some output');
      detector.destroy();
      // Advancing timers should not trigger callbacks
      vi.advanceTimersByTime(10000);
      expect(onStateChange).not.toHaveBeenCalledWith('review');
    });
  });
});
