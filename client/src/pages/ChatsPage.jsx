import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import MessageInput from '../components/MessageInput';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { createDirectChat } from '../api/chatApi';
import { searchUsers } from '../api/usersApi';

const ChatsPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const {
    chats,
    selectedChatId,
    messages,
    typing,
    loadChats,
    setSelectedChat,
    loadMessages,
    sendMessage,
    connectSocket,
    reset,
    upsertChat,
    socket,
  } = useChatStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      reset();
      navigate('/login');
      return;
    }
    connectSocket(user.id);
    loadChats(user.id);
  }, [user, connectSocket, loadChats, reset, navigate]);

  useEffect(() => {
    if (selectedChatId && !messages[selectedChatId]) {
      loadMessages(selectedChatId);
    }
  }, [selectedChatId, messages, loadMessages]);

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.id === selectedChatId) || null,
    [chats, selectedChatId]
  );

  const handleCreateChat = async (otherUserId) => {
    const { chat } = await createDirectChat({ otherUserId });
    upsertChat(chat, user.id);
    setSelectedChat(chat.id);
    setIsSearchOpen(false);
    setSearchTerm('');
    setSearchResults([]);
  };

  useEffect(() => {
    if (!isSearchOpen) return;
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const { users } = await searchUsers(searchTerm.trim());
        setSearchResults(users);
      } catch (error) {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, isSearchOpen]);

  const typingUsers = useMemo(() => typing[selectedChatId] || [], [typing, selectedChatId]);

  const header = (
    <div className="header-content">
      <div>
        <div className="app-title">MediChat</div>
        <div className="app-subtitle">Безопасная переписка внутри клиники</div>
      </div>
      <div className="header-user">
        <div>
          <div className="user-name">{user.displayName || user.username}</div>
          <div className="user-meta">
            {user.role || 'staff'} · {user.department || 'Отдел не указан'}
          </div>
        </div>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => {
            logout();
            reset();
            navigate('/login');
          }}
        >
          Выйти
        </button>
      </div>
    </div>
  );

  const sidebar = (
    <div className="sidebar">
      <div className="sidebar__top">
        <button type="button" className="primary-btn" onClick={() => setIsSearchOpen(true)}>
          Новый чат
        </button>
      </div>
      <ChatList chats={chats} selectedChatId={selectedChatId} onSelect={setSelectedChat} />
    </div>
  );

  return (
    <Layout header={header} sidebar={sidebar}>
      {selectedChat && (
        <>
          <ChatWindow
            chat={selectedChat}
            messages={messages[selectedChatId] || []}
            currentUserId={user.id}
            typingUsers={typingUsers}
          />
          <MessageInput
            disabled={!socket}
            onSend={(text) => sendMessage(selectedChatId, text)}
            onTypingStart={() => socket?.emit('typing:start', { chatId: selectedChatId })}
            onTypingStop={() => socket?.emit('typing:stop', { chatId: selectedChatId })}
          />
        </>
      )}
      {!selectedChat && <div className="empty-state">Выберите чат или создайте новый.</div>}

      {isSearchOpen && (
        <div className="modal-backdrop" onClick={() => setIsSearchOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h3>Новый чат</h3>
              <button type="button" className="secondary-btn" onClick={() => setIsSearchOpen(false)}>
                Закрыть
              </button>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Поиск по имени, email или логину"
              className="field-input"
            />
            {searchLoading && <div className="muted">Поиск...</div>}
            {!searchLoading && searchResults.length === 0 && searchTerm && (
              <div className="muted">Ничего не найдено</div>
            )}
            <ul className="search-list">
              {searchResults.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="search-list__item"
                    onClick={() => handleCreateChat(item.id)}
                  >
                    <div className="search-list__name">{item.displayName || item.username}</div>
                    <div className="search-list__meta">
                      {item.role || 'staff'} · {item.department || 'Отдел не указан'} · {item.email}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default ChatsPage;
