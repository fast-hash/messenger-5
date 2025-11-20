import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import MessageInput from '../components/MessageInput';
import ConfirmDialog from '../components/ConfirmDialog';
import GroupDirectoryModal from '../components/GroupDirectoryModal';
import GroupManageModal from '../components/GroupManageModal';
import UserPicker from '../components/UserPicker';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { createDirectChat, createGroupChat, listGroups, requestJoin } from '../api/chatApi';
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

  const [showChoice, setShowChoice] = useState(false);
  const [showDirect, setShowDirect] = useState(false);
  const [showDirectory, setShowDirectory] = useState(false);
  const [manageChatId, setManageChatId] = useState(null);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [selectedDirect, setSelectedDirect] = useState([]);
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const [newGroupParticipants, setNewGroupParticipants] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

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

  const typingUsers = useMemo(() => typing[selectedChatId] || [], [typing, selectedChatId]);
  const canCreateGroup = user && user.role === 'admin';

  const openConfirm = (text, action) => {
    setConfirmState({ text, action });
  };

  const ensureUsersLoaded = async () => {
    if (users.length) return;
    const { users: fetched } = await searchUsers('');
    setUsers(fetched);
  };

  const refreshGroups = async () => {
    setGroupsLoading(true);
    try {
      const { groups: fetched } = await listGroups();
      setGroups(fetched);
    } catch (error) {
      setGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  };

  const openDirectModal = async () => {
    setShowChoice(false);
    setShowDirect(true);
    await ensureUsersLoaded();
  };

  const openGroupDirectory = async () => {
    setShowChoice(false);
    setShowDirectory(true);
    await ensureUsersLoaded();
    await refreshGroups();
  };

  const closeModals = () => {
    setShowChoice(false);
    setShowDirect(false);
    setShowDirectory(false);
    setManageChatId(null);
    setSelectedDirect([]);
    setNewGroupTitle('');
    setNewGroupParticipants([]);
  };

  const handleDirectSelect = (ids) => {
    setSelectedDirect(ids);
    const target = users.find((u) => u.id === ids[0]);
    if (!target) return;
    openConfirm(`Начать личный чат с ${target.displayName || target.username}?`, async () => {
      const { chat } = await createDirectChat({ otherUserId: target.id });
      upsertChat(chat, user.id);
      setSelectedChat(chat.id);
      closeModals();
    });
  };

  const handleCreateGroup = async () => {
    if (!newGroupTitle.trim()) return;
    const payload = {
      title: newGroupTitle,
      participantIds: newGroupParticipants,
    };
    const { chat } = await createGroupChat(payload);
    if (chat) {
      upsertChat(chat, user.id);
      setSelectedChat(chat.id);
    }
    await refreshGroups();
    setNewGroupTitle('');
    setNewGroupParticipants([]);
    setShowDirectory(false);
  };

  const handleRequestJoin = async (group) => {
    await requestJoin(group.id);
    await refreshGroups();
  };

  const openManageModal = async (chatId) => {
    await ensureUsersLoaded();
    setManageChatId(chatId);
  };

  const handleManageUpdated = (chat) => {
    upsertChat(chat, user.id);
    refreshGroups();
  };

  const handleSelectChat = (chatId) => {
    setSelectedChat(chatId);
  };

  return (
    <Layout
      header={
        <div className="header-content">
          <div>
            <div className="app-title">MediChat</div>
            <div className="app-subtitle">Безопасная переписка внутри клиники</div>
          </div>
          <div className="header-user">
            <div>
              <div className="user-name">{user.displayName || user.username}</div>
              <div className="user-meta">{formatRole(user.role)} · {user.department || 'Отдел не указан'}</div>
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
      }
      sidebar={
        <div className="sidebar">
          <div className="sidebar__top">
            <button type="button" className="primary-btn" onClick={() => setShowChoice(true)}>
              Новый чат
            </button>
          </div>
          <ChatList chats={chats} selectedChatId={selectedChatId} onSelect={handleSelectChat} />
        </div>
      }
    >
      {selectedChat && (
        <>
          <ChatWindow
            chat={selectedChat}
            messages={messages[selectedChatId] || []}
            currentUserId={user.id}
            typingUsers={typingUsers}
            onToggleNotifications={toggleNotifications}
            onOpenManage={openManageModal}
          />
          <MessageInput
            disabled={!socket || (selectedChat.type === 'group' && selectedChat.removed)}
            onSend={(text) => sendMessage(selectedChatId, text)}
            onTypingStart={() =>
              !selectedChat.removed && socket?.emit('typing:start', { chatId: selectedChatId })
            }
            onTypingStop={() => !selectedChat.removed && socket?.emit('typing:stop', { chatId: selectedChatId })}
          />
        </>
      )}
      {!selectedChat && <div className="empty-state">Выберите чат или создайте новый.</div>}

      {showChoice && (
        <div className="modal-backdrop" onClick={closeModals}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h3>Новый чат</h3>
              <button type="button" className="secondary-btn" onClick={closeModals}>
                Закрыть
              </button>
            </div>
            <p className="muted">Выберите тип диалога.</p>
            <div className="choice-buttons">
              <button type="button" className="primary-btn" onClick={openDirectModal}>
                Личный чат
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={openGroupDirectory}
                title="Каталог и создание групп"
              >
                Групповые чаты
              </button>
            </div>
          </div>
        </div>
      )}

      {showDirect && (
        <div className="modal-backdrop" onClick={closeModals}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h3>Личный чат</h3>
              <button type="button" className="secondary-btn" onClick={closeModals}>
                Закрыть
              </button>
            </div>
            <UserPicker
              mode="single"
              users={users}
              selectedIds={selectedDirect}
              onChange={handleDirectSelect}
              excludeIds={[user.id]}
            />
          </div>
        </div>
      )}

      <GroupDirectoryModal
        isOpen={showDirectory}
        onClose={closeModals}
        isAdmin={canCreateGroup}
        users={users}
        groups={groups}
        loading={groupsLoading}
        selectedIds={newGroupParticipants}
        onChangeSelected={setNewGroupParticipants}
        onCreateGroup={() => openConfirm(`Создать группу "${newGroupTitle}"?`, handleCreateGroup)}
        onRequestJoin={(group) => openConfirm(`Вы хотите подать заявку в группу "${group.title}"?`, () => handleRequestJoin(group))}
        onOpenChat={(chatId) => {
          setSelectedChat(chatId);
          closeModals();
        }}
        onManage={openManageModal}
        groupTitle={newGroupTitle}
        onTitleChange={setNewGroupTitle}
        currentUserId={user.id}
        onConfirm={openConfirm}
      />

      <GroupManageModal
        isOpen={!!manageChatId}
        chatId={manageChatId}
        onClose={() => setManageChatId(null)}
        users={users}
        onUpdated={handleManageUpdated}
        openConfirm={openConfirm}
      />

      {confirmState && (
        <ConfirmDialog
          text={confirmState.text}
          onConfirm={async () => {
            await confirmState.action();
            setConfirmState(null);
          }}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </Layout>
  );
};

export default ChatsPage;
