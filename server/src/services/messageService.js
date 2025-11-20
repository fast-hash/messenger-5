const Chat = require('../models/Chat');
const Message = require('../models/Message');
const cryptoService = require('./crypto/cryptoService');

const ensureParticipant = (chatDoc, userId) => {
  const isParticipant = chatDoc.participants
    .map((id) => id.toString())
    .includes(userId.toString());

  if (!isParticipant) {
    const error = new Error('Not authorized for this chat');
    error.status = 403;
    throw error;
  }
};

const toMessageDto = (messageDoc, text) => ({
  id: messageDoc._id.toString(),
  chatId: messageDoc.chat.toString(),
  senderId: messageDoc.sender.toString(),
  text,
  createdAt: messageDoc.createdAt,
});

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

  ensureParticipant(chat, viewerId);

  const messages = await Message.find({ chat: chatId }).sort({ createdAt: 1 });

  const results = [];
  for (const message of messages) {
    // eslint-disable-next-line no-await-in-loop
    const safeText = await cryptoService.decrypt(message, { viewerId });
    results.push(toMessageDto(message, safeText));
  }

  return results;
};

module.exports = {
  sendMessage,
  getMessagesForChat,
};
