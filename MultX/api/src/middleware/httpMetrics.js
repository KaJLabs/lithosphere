const ROUTES = [
  ['GET', /^\/bridge\/status\/[^/]+$/, '/bridge/status/:txHash'],
  ['GET', /^\/bridge\/signatures\/[^/]+$/, '/bridge/signatures/:txHash'],
  ['GET', /^\/bridge\/transactions\/[^/]+$/, '/bridge/transactions/:address'],
  ['GET', /^\/tokens\/[^/]+$/, '/tokens/:tokenAddress'],
  ['GET', /^\/chains\/?$/, '/chains'],
  ['GET', /^\/health\/?$/, '/health'],
  ['GET', /^\/metrics\/?$/, '/metrics'],
];
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']);

export function metricMethod(method) {
  const normalized = String(method || '').toUpperCase();
  return METHODS.has(normalized) ? normalized : 'OTHER';
}

export function metricRoute(method, pathname) {
  const normalizedMethod = String(method || '').toUpperCase();
  const normalizedPath = String(pathname || '').split('?')[0];
  const match = ROUTES.find(([candidateMethod, pattern]) => (
    candidateMethod === normalizedMethod && pattern.test(normalizedPath)
  ));
  return match?.[2] || '/unmatched';
}

export function instrumentHttpRequest(httpRequestsTotal, httpRequestDuration) {
  return (req, res, next) => {
    const route = metricRoute(req.method, req.path);
    const method = metricMethod(req.method);
    const end = httpRequestDuration.startTimer({ method, route });
    res.on('finish', () => {
      httpRequestsTotal.inc({ method, route, status_code: res.statusCode });
      end();
    });
    next();
  };
}
