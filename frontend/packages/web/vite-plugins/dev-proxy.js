import { createLogger } from 'vite';

const HARMLESS_PROXY_ERROR_CODES = new Set(['EPIPE', 'ECONNRESET', 'ECONNABORTED']);

function isHarmlessProxySocketError(error) {
  return HARMLESS_PROXY_ERROR_CODES.has(error?.code);
}

function isHarmlessViteProxyLog(message, error) {
  if (typeof message !== 'string') {
    return false;
  }
  if (!message.includes('ws proxy socket error') && !message.includes('http proxy error')) {
    return false;
  }
  return isHarmlessProxySocketError(error);
}

export function createDevViteLogger() {
  const logger = createLogger('info', { allowClearScreen: true });

  return {
    ...logger,
    error(message, options) {
      if (isHarmlessViteProxyLog(message, options?.error)) {
        return;
      }
      logger.error(message, options);
    },
  };
}

function attachProxyErrorHandlers(proxy) {
  proxy.on('error', (error) => {
    if (isHarmlessProxySocketError(error)) {
      return;
    }
    console.error('[vite proxy]', error);
  });

  proxy.on('proxyReqWs', (_proxyReq, _req, socket) => {
    socket.on('error', (error) => {
      if (isHarmlessProxySocketError(error)) {
        return;
      }
      console.error('[vite ws proxy]', error);
    });
  });
}

export function createDevApiProxy({ target, headers }) {
  return {
    target,
    secure: false,
    changeOrigin: true,
    headers,
    ws: true,
    configure: attachProxyErrorHandlers,
  };
}
