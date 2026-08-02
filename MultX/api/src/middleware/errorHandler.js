export function errorHandler(err, req, res, next) {
  console.error('[Error]', err.message);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: message,
    statusCode: statusCode
  });
}

export default errorHandler;
