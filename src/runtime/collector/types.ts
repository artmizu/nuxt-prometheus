export interface OutboundRequestTiming {
  start: number
  end: number
}

export interface OutboundRequestsState {
  requests: Record<string, OutboundRequestTiming>
}

export interface OutboundCollectorOptions {
  getState: () => OutboundRequestsState | undefined
  onRequest?: (url: string, startedAt: number) => void
}

export interface OutboundCollector {
  start: () => void
  stop: () => void
}
