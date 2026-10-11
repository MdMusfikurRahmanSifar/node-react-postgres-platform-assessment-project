import client from "prom-client";

// Collect standard Node.js runtime metrics (CPU, Memory, Event Loop)
client.collectDefaultMetrics({ prefix: "nodejs_" });

export const httpRequestCounter = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests processed",
  labelNames: ["method", "route", "status"],
});

export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Histogram of HTTP request durations in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

export const metricsMiddleware = (req, res, next) => {
  if (req.path === "/metrics") return next();
  const start = process.hrtime();

  res.on("finish", () => {
    const elapsed = process.hrtime(start);
    const durationSeconds = elapsed[0] + elapsed[1] / 1e9;
    const route = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;
    const status = res.statusCode ? res.statusCode.toString() : "unknown";

    httpRequestCounter.inc({ method: req.method, route, status });
    httpRequestDuration.observe({ method: req.method, route, status }, durationSeconds);
  });

  next();
};

export async function getMetrics() {
  return client.register.metrics();
}

export function getContentType() {
  return client.register.contentType;
}
