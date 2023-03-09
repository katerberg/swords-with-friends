import * as express from 'express';

export function setup(): express.Express {
  const app = express();

  app.use((req, res, next) => {
    const allowedOrigins = [
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://0.0.0.0:8080',
      'http://192.168.50.132:8080',
      'http://localhost:9080',
      'http://127.0.0.1:9080',
      'http://0.0.0.0:9080',
      'http://192.168.50.132:9080',
    ];
    const {origin} = req.headers;
    if (origin) {
      if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
    }
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    return next();
  });

  return app;
}
