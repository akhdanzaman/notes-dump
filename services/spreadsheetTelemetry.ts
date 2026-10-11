/** Bounded diagnostics: never retain URLs, credentials, request bodies or cell values. */
export interface SpreadsheetRequestMetric {
  at: number;
  operation: 'metadata' | 'read' | 'write';
  durationMs: number;
  requestBytes: number;
  responseBytes: number;
  status: number;
  errorCode?: string;
}
const metrics: SpreadsheetRequestMetric[] = [];
export function recordSpreadsheetRequest(metric: SpreadsheetRequestMetric) {
  metrics.push(metric);
  if (metrics.length > 200) metrics.splice(0, metrics.length - 200);
}
export function getSpreadsheetDiagnostics() {
  const requests = metrics.map(metric => ({ ...metric }));
  return { version: 1, requests, summary: {
    requests: requests.length,
    reads: requests.filter(metric => metric.operation !== 'write').length,
    writes: requests.filter(metric => metric.operation === 'write').length,
    requestBytes: requests.reduce((sum, metric) => sum + metric.requestBytes, 0),
    responseBytes: requests.reduce((sum, metric) => sum + metric.responseBytes, 0),
  } };
}
export function resetSpreadsheetDiagnostics() { metrics.length = 0; }
