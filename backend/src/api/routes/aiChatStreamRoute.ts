/**
 * aiChatStreamRoute.ts
 *
 * SSE (Server-Sent Events) streaming route for AI chat responses.
 *
 * POST /tenant/ai-assistant/chat/stream
 *
 * Uses the same auth, permission, and rate-limiting pipeline as the
 * regular chat endpoint. Instead of waiting for the full response,
 * streams tokens as they arrive from the AI provider.
 *
 * Event types sent to client:
 * - token:      Partial AI text content
 * - tool_call:  AI requested a tool invocation
 * - tool_result:Result of executing a tool server-side
 * - done:       Response complete (includes metadata)
 * - error:      An error occurred
 *
 * The connection is kept alive with keep-alive comments every 15 seconds
 * and is closed after the 'done' or 'error' event is sent.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { diContainer } from '../../infrastructure/di/bindRepositories';
import { validateSendChatMessageInput } from '../validators/ai-assistant.validators';
import { permissionGuard } from '../middlewares/guards/permissionGuard';

const router = Router();

// Apply permission guard — same as the regular chat endpoint
router.use(permissionGuard('ai-assistant.chat.use'));

/**
 * POST /stream
 * Stream AI chat responses via Server-Sent Events.
 */
async function handleStream(req: Request, res: Response, _next: NextFunction): Promise<void> {
  // Validate input
  try {
    validateSendChatMessageInput(req.body);
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
    return;
  }

  const companyId = (req as any).tenantContext?.companyId;
  const userId = (req as any).tenantContext?.userId;

  if (!companyId || !userId) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const { message, conversationId } = req.body;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  // Helper to send SSE events
  function sendSSE(event: string, data: unknown): void {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  // Keep-alive: send a comment every 15 seconds to prevent proxy timeouts
  const keepAlive = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 15000);

  // Handle client disconnect
  let clientDisconnected = false;
  req.on('close', () => {
    clientDisconnected = true;
    clearInterval(keepAlive);
  });

  try {
    const useCase = diContainer.streamChatMessageUseCase;

    for await (const event of useCase.executeStream({
      companyId,
      userId,
      message,
      conversationId,
    })) {
      if (clientDisconnected) break;

      switch (event.type) {
        case 'token':
          sendSSE('token', { content: event.content });
          break;

        case 'tool_call':
          sendSSE('tool_call', {
            toolName: event.toolName,
            toolCallId: event.toolCallId,
            toolArgs: event.toolArgs,
          });
          break;

        case 'tool_result':
          sendSSE('tool_result', {
            toolName: event.toolName,
            data: event.data,
            approved: event.approved,
          });
          break;

        case 'done':
          sendSSE('done', { metadata: event.metadata });
          break;

        case 'error':
          sendSSE('error', { message: event.message });
          break;
      }
    }
  } catch (error) {
    if (!clientDisconnected && !res.writableEnded) {
      sendSSE('error', {
        message: error instanceof Error ? error.message : 'An unexpected error occurred during streaming.',
      });
    }
  } finally {
    clearInterval(keepAlive);
    if (!res.writableEnded) {
      res.end();
    }
  }
}

router.post('/stream', handleStream);

export default router;