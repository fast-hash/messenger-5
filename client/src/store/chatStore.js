import { create } from 'zustand';
import { io } from 'socket.io-client';
import * as chatApi from '../api/chatApi';
import * as messagesApi from '../api/messagesApi';

const mapChat = (chat, currentUserId) => {
  const base = {
    ...chat,
    notificationsEnabled: chat.notificationsEnabled ?? true,
  };

  if (chat.type === 'group') {
    return {
      ...base,
      otherUser: null,
      isOnline: false,
    };
  }

  const otherUser = chat.participants.find((participant) => participant.id !== currentUserId) || chat.participants[0];
  return {
    ...base,
    otherUser,
    isOnline: false,
  };
};

export const useChatStore = create((set, get) => ({
  chats: [],
  selectedChatId: null,
  messages: {},
  typing: {},
  socket: null,
  connectSocket(currentUserId) {
    if (get().socket) {
      return;
    }

    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
      withCredentials: true,
    });

    socket.on('message:new', ({ message }) => {
      get().addMessage(message.chatId, message);
      get().updateChatLastMessage(message.chatId, message);
    });

    socket.on('presence:online', ({ userId }) => {
      get().updateUserPresence(userId, true);
    });

    socket.on('presence:offline', ({ userId }) => {
      get().updateUserPresence(userId, false);
    });

    socket.on('typing:started', ({ chatId, userId }) => {
      if (userId === currentUserId) return;
      get().setTyping(chatId, userId, true);
    });

    socket.on('typing:stopped', ({ chatId, userId }) => {
      if (userId === currentUserId) return;
      get().setTyping(chatId, userId, false);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connect error', err);
    });

    set({ socket });
  },
  setSocket(socket) {
    set({ socket });
  },
  reset() {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
    }
    set({ chats: [], selectedChatId: null, messages: {}, typing: {}, socket: null });
  },
  async loadChats(currentUserId) {
    const { chats } = await chatApi.getChats();
    const mapped = chats.map((chat) => mapChat(chat, currentUserId));
    mapped.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    set({ chats: mapped });

    // Сразу подписываемся на комнаты всех чатов, чтобы получать presence и новые сообщения в списке.
    const socket = get().socket;
    if (socket) {
      mapped.forEach((chat) => socket.emit('chats:join', { chatId: chat.id }));
    }
  },
  setSelectedChat(chatId) {
    const socket = get().socket;
    const chat = get().chats.find((c) => c.id === chatId);
    if (socket && chatId && chat && !chat.removed) {
      socket.emit('chats:join', { chatId });
    }
    set({ selectedChatId: chatId });
  },
  async loadMessages(chatId) {
    const { messages } = await messagesApi.getMessages(chatId);
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: messages,
      },
    }));
  },
  async sendMessage(chatId, text) {
    const socket = get().socket;
    if (socket) {
      socket.emit('message:send', { chatId, text });
      return;
    }
    const { message } = await messagesApi.sendMessage({ chatId, text });
    get().addMessage(chatId, message);
    get().updateChatLastMessage(chatId, message);
  },
  addMessage(chatId, message) {
    set((state) => {
      const chatMessages = state.messages[chatId] || [];
      if (chatMessages.some((existing) => existing.id === message.id)) {
        return state;
      }
      return {
        messages: {
          ...state.messages,
          [chatId]: [...chatMessages, message],
        },
      };
    });
  },
  updateChatLastMessage(chatId, message) {
    set((state) => {
      const updatedChats = state.chats.map((chat) => {
        if (chat.id !== chatId) return chat;
        return {
          ...chat,
          lastMessage: {
            text: message.text,
            senderId: message.senderId,
            createdAt: message.createdAt,
          },
          updatedAt: message.createdAt,
        };
      });
      updatedChats.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      return { chats: updatedChats };
    });
  },
  updateUserPresence(userId, isOnline) {
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.otherUser && chat.otherUser.id === userId ? { ...chat, isOnline } : chat
      ),
    }));
  },
  setTyping(chatId, userId, isTyping) {
    set((state) => {
      const existing = new Set(state.typing[chatId] || []);
      if (isTyping) {
        existing.add(userId);
      } else {
        existing.delete(userId);
      }
      return {
        typing: {
          ...state.typing,
          [chatId]: Array.from(existing),
        },
      };
    });
  },
  toggleNotifications(chatId) {
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId
          ? { ...chat, notificationsEnabled: !(chat.notificationsEnabled ?? true) }
          : chat
      ),
    }));
  },
  upsertChat(chat, currentUserId) {
    const mapped = mapChat(chat, currentUserId);
    set((state) => {
      const without = state.chats.filter((c) => c.id !== mapped.id);
      const next = [...without, mapped];
      next.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      return { chats: next };
    });

    const socket = get().socket;
    if (socket && !mapped.removed) {
      socket.emit('chats:join', { chatId: mapped.id });
    }
  },
}));
