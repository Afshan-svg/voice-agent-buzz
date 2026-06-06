import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import { env, isProduction } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './utils/errors';
import { logger } from './utils/logger';
import routes from './routes';
import { mediaStreamHandler } from './modules/calls/media-stream.handler';
import { browserStreamHandler } from './modules/calls/browser-stream.handler';
import { NoOpAudioBridge } from './modules/calls/audio-bridge';
import {
  createAudioBridge,
  logAudioBridgeFallback,
} from './integrations/openai/realtime-audio-bridge';
import { realtimeVoiceService } from './integrations/openai/realtime-voice.service';
import { toolExecutorService } from './services/tool-executor.service';
import { knowledgeService } from './modules/knowledge/knowledge.service';

import path from 'path';

const app = express();
const server = http.createServer(app);

const MEDIA_STREAM_PATH = '/webhooks/twilio/media-stream';
const BROWSER_STREAM_PATH = '/ws/browser-session';

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, request) => {
  const pathname = request.url?.split('?')[0];
  if (pathname === MEDIA_STREAM_PATH) {
    mediaStreamHandler.handleConnection(ws);
  } else if (pathname === BROWSER_STREAM_PATH) {
    browserStreamHandler.handleConnection(ws);
  } else {
    ws.close();
  }
});

server.on('upgrade', (request, socket, head) => {
  const pathname = request.url?.split('?')[0];

  if (pathname === MEDIA_STREAM_PATH || pathname === BROWSER_STREAM_PATH) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
    return;
  }

  socket.destroy();
});

app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: isProduction,
  })
);
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(isProduction ? 'combined' : 'dev'));
app.use(requestLogger);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 200 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests' },
    skip: (req) => req.path === MEDIA_STREAM_PATH,
  })
);

app.use(routes);

// Serve frontend
const frontendPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/webhooks') || req.path.startsWith('/auth')) {
    return next();
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use(notFoundHandler);
app.use(errorHandler);

async function bootstrap(): Promise<void> {
  try {
    await connectDatabase();
    logger.info('Database connected');

    await connectRedis();
    logger.info('Redis connected');

    await knowledgeService.ensureUploadDir();

    if (env.OPENAI_API_KEY && !env.OPENAI_API_KEY.startsWith('sk-your-')) {
      const audioBridge = createAudioBridge();
      mediaStreamHandler.setAudioBridge(audioBridge);
      browserStreamHandler.setAudioBridge(audioBridge);
      toolExecutorService.registerSessionEndHandler((callSid) =>
        realtimeVoiceService.endSession(callSid)
      );
      logger.info('OpenAI Realtime audio bridge enabled', {
        model: env.OPENAI_REALTIME_MODEL,
        voice: env.OPENAI_REALTIME_VOICE,
      });
    } else {
      const noOpBridge = new NoOpAudioBridge();
      mediaStreamHandler.setAudioBridge(noOpBridge);
      browserStreamHandler.setAudioBridge(noOpBridge);
      logAudioBridgeFallback('OPENAI_API_KEY not configured');
    }

    server.listen(env.PORT, env.HOST, () => {
      logger.info('BuzznessAI Hotel Receptionist running', {
        url: `http://${env.HOST}:${env.PORT}`,
        mediaStreamUrl: env.PUBLIC_URL.replace(/^http/, 'ws') + MEDIA_STREAM_PATH,
        publicUrl: env.PUBLIC_URL,
        openaiRealtimeEnabled: Boolean(
          env.OPENAI_API_KEY && !env.OPENAI_API_KEY.startsWith('sk-your-')
        ),
        environment: env.NODE_ENV,
      });
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully`);

  wss.clients.forEach((client) => {
    client.close();
  });

  server.close(async () => {
    await disconnectRedis();
    await disconnectDatabase();
    logger.info('Server shut down complete');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

void bootstrap();

export { app, server, wss };
