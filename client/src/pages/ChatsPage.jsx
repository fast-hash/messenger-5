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
import { formatRole } from '../utils/roleLabels';

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
    toggleNotifications,
  } = useChatStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [newChatStep, setNewChatStep] = useState(null); // choice | direct | group-info
  const [groupMessage, setGroupMessage] = useState('');

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
    setNewChatStep(null);
    setSearchTerm('');
    setSearchResults([]);
  };

  useEffect(() => {
    if (newChatStep !== 'direct') return;
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
  }, [searchTerm, newChatStep]);

  const typingUsers = useMemo(() => typing[selectedChatId] || [], [typing, selectedChatId]);

  const canCreateGroup = user && (user.role === 'doctor' || user.role === 'admin');

  const closeNewChatModal = () => {
    setNewChatStep(null);
    setSearchTerm('');
    setSearchResults([]);
    setGroupMessage('');
  };

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
            {formatRole(user.role)} · {user.department || 'Отдел не указан'}
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
        <button type="button" className="primary-btn" onClick={() => setNewChatStep('choice')}>
          Новый чат
        </button>
      </div>
      <ChatList chats={chats} selectedChatId={selectedChatId} onSelect={setSelectedChat} />
    </div>
  );

  const renderNewChatModal = () => {
    if (!newChatStep) return null;

    if (newChatStep === 'choice') {
      return (
        <div className="modal-backdrop" onClick={closeNewChatModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h3>Новый чат</h3>
              <button type="button" className="secondary-btn" onClick={closeNewChatModal}>
                Закрыть
              </button>
            </div>
            <p className="muted">Выберите тип диалога. Групповые чаты пока в разработке (описание в дипломе).</p>
            <div className="choice-buttons">
              <button type="button" className="primary-btn" onClick={() => setNewChatStep('direct')}>
                Личный чат
              </button>
              <button
                type="button"
                className="secondary-btn"
                disabled={!canCreateGroup}
                title={
                  canCreateGroup ? 'Группа' : 'Создавать групповые чаты может только врач или администратор системы.'
                }
                onClick={() => {
                  if (!canCreateGroup) {
                    setGroupMessage('Создавать групповые чаты может только врач или администратор системы.');
                  } else {
                    setGroupMessage(
                      'Групповой чат находится в разработке и будет реализован на следующем этапе. Подробности см. в разделе диплома о расширении функционала.'
                    );
                  }
                  setNewChatStep('group-info');
                }}
              >
                Группа
              </button>
            </div>
            {!canCreateGroup && <p className="muted small">Доступ к созданию групп есть только у врача или администратора.</p>}
          </div>
        </div>
      );
    }

    if (newChatStep === 'direct') {
      return (
        <div className="modal-backdrop" onClick={closeNewChatModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h3>Личный чат</h3>
              <button type="button" className="secondary-btn" onClick={closeNewChatModal}>
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
                      {formatRole(item.role)} · {item.department || 'Отдел не указан'} · {item.email}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    }

    if (newChatStep === 'group-info') {
      return (
        <div className="modal-backdrop" onClick={closeNewChatModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h3>Групповой чат</h3>
              <button type="button" className="secondary-btn" onClick={closeNewChatModal}>
                Закрыть
              </button>
            </div>
            <p>{groupMessage}</p>
            <p className="muted small">
              {/* Пока только UI-заготовка: полноценные группы (создатель врач/админ, управление участниками) будут добавлены на следующем этапе и описаны в дипломе. */}
              Сейчас реализован только интерфейс выбора. Полное поведение (создатель — врач/админ, набор участников, права)
              описывается в пояснительной записке и будет добавлено на следующем этапе.
            </p>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Layout header={header} sidebar={sidebar}>
      {selectedChat && (
        <>
          <ChatWindow
            chat={selectedChat}
            messages={messages[selectedChatId] || []}
            currentUserId={user.id}
            typingUsers={typingUsers}
            onToggleNotifications={toggleNotifications}
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

      {renderNewChatModal()}
    </Layout>
  );
};

export default ChatsPage;
