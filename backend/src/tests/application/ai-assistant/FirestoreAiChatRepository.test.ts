import { FirestoreAiChatRepository } from '../../../infrastructure/firestore/repositories/ai-assistant/FirestoreAiChatRepository';
import { AiChatMessage } from '../../../domain/ai-assistant/entities/AiChatMessage';

describe('FirestoreAiChatRepository', () => {
  it('should strip nested undefined values before writing chat messages to Firestore', async () => {
    const set = jest.fn().mockResolvedValue(undefined);
    const messageDoc = { set };
    const chatMessagesCollection = { doc: jest.fn(() => messageDoc) };
    const dataDoc = { collection: jest.fn(() => chatMessagesCollection) };
    const aiAssistantCollection = { doc: jest.fn(() => dataDoc) };
    const companyDoc = { collection: jest.fn(() => aiAssistantCollection) };
    const companiesCollection = { doc: jest.fn(() => companyDoc) };
    const db = { collection: jest.fn(() => companiesCollection) } as any;

    const repository = new FirestoreAiChatRepository(db);
    const message = AiChatMessage.create({
      companyId: 'company-1',
      userId: 'user-1',
      conversationId: 'conv-1',
      role: 'assistant',
      content: 'Trial balance summary',
      provider: 'mock',
      model: 'mock-model',
      metadata: {
        toolCallResults: undefined,
        keep: 'value',
        nested: {
          removeMe: undefined,
          keepMe: true,
        },
        list: [
          { keep: 1, removeMe: undefined },
          undefined,
          { keep: 2 },
        ],
      },
    });

    await repository.create(message);

    expect(set).toHaveBeenCalledTimes(1);
    const savedPayload = set.mock.calls[0][0];
    expect(savedPayload.metadata).toEqual({
      keep: 'value',
      nested: { keepMe: true },
      list: [{ keep: 1 }, { keep: 2 }],
    });
    expect(JSON.stringify(savedPayload)).not.toContain('undefined');
  });
});
