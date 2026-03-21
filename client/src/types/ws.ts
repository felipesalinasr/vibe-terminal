export type TerminalInboundMessage =
  | { type: 'output'; data: string }
  | { type: 'scrollback'; data: string }
  | { type: 'state'; state: string }
  | { type: 'file'; path: string }
  | { type: 'skills-changed'; skills: { folder: string; name: string; description: string }[] }
  | { type: 'historical' }
  | { type: 'exit' }

export type TerminalOutboundMessage =
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
