const Chat = require('../models/Chat');
const Message = require('../models/Message');
const cryptoService = require('./crypto/cryptoService');

const ensureParticipant = (chatDoc, userId, { allowRemoved = false } = {}) => {
  const participantIds = (chatDoc.participants || []).map((id) => id.toString());
  const idStr = userId.toString();

  if (participantIds.includes(idStr)) {
    return;
  }

  if (allowRemoved) {
    const removedEntries = (chatDoc.removedFor || []).filter((entry) => entry && entry.user);
    const latest = removedEntries
      .filter((entry) => entry.user.toString() === idStr)
      .sort((a, b) => new Date(b.removedAt || 0) - new Date(a.removedAt || 0))[0];
    if (latest) return;
  }

  const error = new Error('Not authorized for this chat');
  error.status = 403;
  throw error;
};

const toMessageDto = (messageDoc, text) => {
  const sender = messageDoc.sender || {};
  const senderDto = sender._id
    ? {
        id: sender._id.toString(),
        displayName: sender.displayName,
        username: sender.username,
        role: sender.role,
        department: sender.department,
        email: sender.email,
      }
    : { id: sender.toString() };

  return {
    id: messageDoc._id.toString(),
    chatId: messageDoc.chat.toString(),
    senderId: messageDoc.sender.toString(),
    sender: senderDto,
    text,
    createdAt: messageDoc.createdAt,
  };
};

const sendMessage = async ({ chatId, senderId, text }) => {
  if (!chatId || !senderId || typeof text !== 'string') {
    const error = new Error('chatId, senderId, and text are required');
    error.status = 400;
    throw error;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    const error = new Error('Message text cannot be empty');
    error.status = 400;
    throw error;
  }

  const chat = await Chat.findById(chatId);
  if (!chat) {
    const error = new Error('Chat not found');
    error.status = 404;
    throw error;
  }

  if (chat.type === 'group' && !chat.participants.map((p) => p.toString()).includes(senderId.toString())) {
    const error = new Error('Вы больше не являетесь участником группы');
    error.status = 403;
    throw error;
  }

  if (chat.type === 'direct' && (chat.blocks || []).some((b) =>
    (b.by && b.target && b.by.toString() === senderId.toString()) ||
    (b.by && b.target && b.target.toString() === senderId.toString())
  )) {
    const error = new Error('Диалог заблокирован');
    error.status = 403;
    throw error;
  }

  ensureParticipant(chat, senderId);

  const { ciphertext, plaintext, encryption } = await cryptoService.encrypt(trimmed, {
    chatId,
    senderId,
  });

  const message = await Message.create({
    chat: chatId,
    sender: senderId,
    plaintext,
    ciphertext,
    encryption,
  });

  await message.populate('sender');

  await Chat.findByIdAndUpdate(chatId, {
    lastMessage: {
      text: plaintext,
      sender: senderId,
      createdAt: message.createdAt,
    },
    updatedAt: message.createdAt,
  });

  const safeText = await cryptoService.decrypt(message, { viewerId: senderId });

  return toMessageDto(message, safeText);
};

const getMessagesForChat = async ({ chatId, viewerId }) => {
  if (!chatId || !viewerId) {
    const error = new Error('chatId and viewerId are required');
    error.status = 400;
    throw error;
  }

  const chat = await Chat.findById(chatId);
  if (!chat) {
    const error = new Error('Chat not found');
    error.status = 404;
    throw error;
  }

  ensureParticipant(chat, viewerId, { allowRemoved: true });

  const removalWindows = (chat.removedFor || [])
    .filter((entry) => entry && entry.user && entry.user.toString() === viewerId.toString())
    .map((entry) => ({
      start: new Date(entry.removedAt || 0),
      end: entry.rejoinedAt ? new Date(entry.rejoinedAt) : null,
    }));

  const messages = await Message.find({ chat: chatId })
    .sort({ createdAt: 1 })
    .populate('sender');

  const results = [];
  for (const message of messages) {
    const inRemovedInterval = removalWindows.some((window) => {
      if (!window.end) {
        return message.createdAt >= window.start;
      }
      return message.createdAt >= window.start && message.createdAt < window.end;
    });
    if (inRemovedInterval) {
      // Пропускаем сообщения, отправленные в период отсутствия пользователя в группе
      // или после удаления, чтобы не возвращать недоступные сообщения при повторном добавлении.
      // eslint-disable-next-line no-continue
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const safeText = await cryptoService.decrypt(message, { viewerId });
    results.push(toMessageDto(message, safeText));
  }

  const readEntry = (chat.readState || []).find(
    (entry) => entry.user && entry.user.toString() === viewerId.toString()
  );

  return { messages: results, lastReadAt: readEntry ? readEntry.lastReadAt : null };
};

module.exports = {
  sendMessage,
  getMessagesForChat,
};
