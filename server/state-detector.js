const IDLE_TIMEOUT_MS = 5000;

export function createStateDetector(onStateChange, onFileDetected, onSkillsChanged) {
  let currentState = 'active';
  let idleTimer = null;
  let skillTimer = null;
  let buffer = '';

  const filePatterns = [
    /● (?:Write|Edit)\(([^)]+)\)/,
    /Created (?:file )?(?:at: )?(.+)$/m,
  ];

  const skillCommandPatterns = [
    /npx skills add/,
    /skills add .+--skill/,
    /Added skill/i,
    /Skill .+ installed/i,
  ];

  const reviewPatterns = [
    /❯\s*$/m,
    /^\s*>\s*$/m,
    /\(y\/n\)/i,
    /\(Y\)es.*\(N\)o/i,
    /Do you want to proceed/i,
    /waiting for.*input/i,
    /Press Enter/i,
  ];

  const activePatterns = [
    /● (Read|Write|Edit|Bash|Glob|Grep|Task)\(/,
    /\.\.\./,
    /Thinking/i,
  ];

  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (currentState === 'active') {
        setState('review');
      }
    }, IDLE_TIMEOUT_MS);
  }

  function setState(newState) {
    if (newState !== currentState) {
      currentState = newState;
      onStateChange(newState);
    }
  }

  function processOutput(data) {
    buffer += data;
    if (buffer.length > 4000) {
      buffer = buffer.slice(-2000);
    }

    if (onFileDetected) {
      for (const pattern of filePatterns) {
        const match = pattern.exec(data);
        if (match && match[1]) {
          onFileDetected(match[1].trim());
        }
      }
    }

    if (onSkillsChanged) {
      for (const pattern of skillCommandPatterns) {
        if (pattern.test(data)) {
          if (skillTimer) clearTimeout(skillTimer);
          skillTimer = setTimeout(() => onSkillsChanged(), 5000);
          break;
        }
      }
    }

    for (const pattern of activePatterns) {
      if (pattern.test(data)) {
        setState('active');
        resetIdleTimer();
        return;
      }
    }

    for (const pattern of reviewPatterns) {
      if (pattern.test(data)) {
        setState('review');
        if (idleTimer) clearTimeout(idleTimer);
        return;
      }
    }

    if (data.trim().length > 0) {
      setState('active');
      resetIdleTimer();
    }
  }

  function destroy() {
    if (idleTimer) clearTimeout(idleTimer);
    if (skillTimer) clearTimeout(skillTimer);
  }

  return { processOutput, destroy, getState: () => currentState };
}
