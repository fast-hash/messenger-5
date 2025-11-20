import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import MessageInput from '../components/MessageInput';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import {
  createDirectChat,
  createGroupChat,
  listGroups,
  getGroupDetails,
  addParticipant,
  removeParticipant,
  renameGroup,
  requestJoin,
  approveJoin,
  rejectJoin,
} from '../api/chatApi';
import { searchUsers } from '../api/usersApi';
import { formatRole } from '../utils/roleLabels';

const ConfirmDialog = ({ text, onConfirm, onCancel }) => (
  <div className="modal-backdrop" onClick={onCancel}>
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      <p>{text}</p>
      <div className="choice-buttons">
        <button type="button" className="primary-btn" onClick={onConfirm}>
          Да
        </button>
        <button type="button" className="secondary-btn" onClick={onCancel}>
          Нет
        </button>
      </div>
    </div>
  </div>
);

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

  const [newChatStep, setNewChatStep] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [groups, setGroups] = useState([]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
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

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return allUsers;
    return allUsers.filter((u) =>
      [u.displayName, u.username, u.email].some((field) => field?.toLowerCase().includes(term))
    );
  }, [allUsers, searchTerm]);

  const typingUsers = useMemo(() => typing[selectedChatId] || [], [typing, selectedChatId]);

  const canCreateGroup = user && user.role === 'admin';

  const closeNewChatModal = () => {
    setNewChatStep(null);
    setSearchTerm('');
    setSelectedUserIds([]);
    setGroupTitle('');
    setSelectedGroup(null);
    setConfirmState(null);
  };

  const openConfirm = (text, action) => {
    setConfirmState({ text, action });
  };

  const ensureUsersLoaded = async () => {
    if (allUsers.length) return;
    const { users } = await searchUsers('');
    setAllUsers(users);
  };

  const openDirectModal = async () => {
    setNewChatStep('direct');
    await ensureUsersLoaded();
  };

  const openGroupModal = async () => {
    setNewChatStep('group');
    await ensureUsersLoaded();
    setGroupLoading(true);
    try {
      const { groups: fetched } = await listGroups();
      setGroups(fetched);
    } catch (error) {
      setGroups([]);
    } finally {
      setGroupLoading(false);
    }
  };

  const handleCreateChat = (otherUser) => {
    openConfirm(`Начать личный чат с ${otherUser.displayName || otherUser.username}?`, async () => {
      const { chat } = await createDirectChat({ otherUserId: otherUser.id });
      upsertChat(chat, user.id);
      setSelectedChat(chat.id);
      closeNewChatModal();
    });
  };

  const handleCreateGroup = () => {
    if (!groupTitle.trim()) return;
    openConfirm(`Создать группу "${groupTitle.trim()}"?`, async () => {
      const { chat } = await createGroupChat({
        title: groupTitle,
        participantIds: selectedUserIds,
      });
      upsertChat(chat, user.id);
      setSelectedChat(chat.id);
      await openGroupModal();
    });
  };

  const loadGroupDetails = async (chatId) => {
    try {
      const details = await getGroupDetails(chatId);
      setSelectedGroup(details);
      if (details.chat) {
        upsertChat(details.chat, user.id);
      }
    } catch (error) {
      setSelectedGroup(null);
    }
  };

  const handleJoinRequest = (group) => {
    openConfirm(`Вы хотите подать заявку в группу "${group.title}"?`, async () => {
      await requestJoin(group.id);
      await openGroupModal();
    });
  };

  const handleApprove = (chatId, target) => {
    openConfirm(`Принять ${target.displayName || target.username} в группу?`, async () => {
      await approveJoin(chatId, target.id);
      await loadGroupDetails(chatId);
      await openGroupModal();
    });
  };

  const handleReject = (chatId, target) => {
    openConfirm(`Отклонить заявку пользователя ${target.displayName || target.username}?`, async () => {
      await rejectJoin(chatId, target.id);
      await loadGroupDetails(chatId);
      await openGroupModal();
    });
  };

  const handleRemoveParticipant = (chatId, target) => {
    openConfirm(
      `Удалить пользователя ${target.displayName || target.username} из группы? Он больше не будет получать сообщения.`,
      async () => {
        await removeParticipant(chatId, target.id);
        await loadGroupDetails(chatId);
        await openGroupModal();
      }
    );
  };

  const handleAddParticipant = (chatId, userId) => {
    openConfirm('Добавить выбранного пользователя в группу?', async () => {
      await addParticipant(chatId, userId);
      await loadGroupDetails(chatId);
      await openGroupModal();
    });
  };

  const handleRename = (chatId, title) => {
    openConfirm(`Переименовать группу в "${title}"?`, async () => {
      await renameGroup(chatId, title);
      await loadGroupDetails(chatId);
      await openGroupModal();
    });
  };

  const renderChoiceModal = () => (
    <div className="modal-backdrop" onClick={closeNewChatModal}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h3>Новый чат</h3>
          <button type="button" className="secondary-btn" onClick={closeNewChatModal}>
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
            onClick={openGroupModal}
            title="Создавать группы может только администратор. Остальные могут подать заявку в существующие группы."
          >
            Группа
          </button>
        </div>
      </div>
    </div>
  );

  const renderDirectModal = () => (
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
        <ul className="search-list">
          {filteredUsers
            .filter((u) => u.id !== user.id)
            .map((item) => (
              <li key={item.id}>
                <button type="button" className="search-list__item" onClick={() => handleCreateChat(item)}>
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

  const renderGroupModal = () => {
    const isAdmin = user.role === 'admin';
    return (
      <div className="modal-backdrop" onClick={closeNewChatModal}>
        <div className="modal large" onClick={(e) => e.stopPropagation()}>
          <div className="modal__header">
            <h3>Групповые чаты</h3>
            <button type="button" className="secondary-btn" onClick={closeNewChatModal}>
              Закрыть
            </button>
          </div>
          {groupLoading && <p className="muted">Загрузка групп...</p>}
          {!groupLoading && (
            <div className="group-grid">
              <div>
                {isAdmin ? (
                  <>
                    <h4>Создать группу</h4>
                    <label className="field">
                      Название группы
                      <input
                        type="text"
                        className="field-input"
                        value={groupTitle}
                        onChange={(e) => setGroupTitle(e.target.value)}
                      />
                    </label>
                    <div className="checkbox-list">
                      {allUsers
                        .filter((u) => u.id !== user.id)
                        .map((u) => (
                          <label key={u.id} className="checkbox-item">
                            <input
                              type="checkbox"
                              checked={selectedUserIds.includes(u.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedUserIds([...selectedUserIds, u.id]);
                                } else {
                                  setSelectedUserIds(selectedUserIds.filter((id) => id !== u.id));
                                }
                              }}
                            />
                            {u.displayName || u.username} ({formatRole(u.role)})
                          </label>
                        ))}
                    </div>
                    <button type="button" className="primary-btn" onClick={handleCreateGroup} disabled={!groupTitle.trim()}>
                      Создать группу
                    </button>
                  </>
                ) : (
                  <p className="muted">
                    Создавать группы может только администратор системы. Вы можете подать заявку в доступные группы ниже.
                  </p>
                )}
                <h4>Список групп</h4>
                <ul className="search-list">
                  {groups.map((group) => (
                    <li key={group.id}>
                      <div className="search-list__item">
                        <div>
                          <div className="search-list__name">{group.title}</div>
                          <div className="search-list__meta">Участников: {group.participantsCount}</div>
                          <div className="search-list__meta">Статус: {group.membershipStatus}</div>
                        </div>
                        <div className="btn-row">
                          {group.membershipStatus === 'member' || group.membershipStatus === 'admin' ? (
                            <button
                              type="button"
                              className="primary-btn"
                              onClick={() => {
                                setSelectedChat(group.id);
                                closeNewChatModal();
                              }}
                            >
                              Открыть чат
                            </button>
                          ) : null}
                          {group.membershipStatus === 'pending' && <span className="muted">Заявка отправлена</span>}
                          {group.membershipStatus === 'none' && (
                            <button type="button" className="secondary-btn" onClick={() => handleJoinRequest(group)}>
                              Подать заявку
                            </button>
                          )}
                          {isAdmin && (
                            <button type="button" className="secondary-btn" onClick={() => loadGroupDetails(group.id)}>
                              Управлять
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              {selectedGroup && selectedGroup.chat && (
                <div className="panel">
                  <h4>Настройки группы</h4>
                  <label className="field">
                    Название
                    <input
                      type="text"
                      className="field-input"
                      value={selectedGroup.chat.title || ''}
                      onChange={(e) =>
                        setSelectedGroup({ ...selectedGroup, chat: { ...selectedGroup.chat, title: e.target.value } })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => handleRename(selectedGroup.chat.id, selectedGroup.chat.title)}
                    disabled={!selectedGroup.chat.title}
                  >
                    Сохранить название
                  </button>

                  <h5>Участники</h5>
                  <ul className="search-list">
                    {selectedGroup.chat.participants.map((participant) => (
                      <li key={participant.id}>
                        <div className="search-list__item">
                          <div>
                            <div className="search-list__name">{participant.displayName || participant.username}</div>
                            <div className="search-list__meta">
                              {formatRole(participant.role)} · {participant.department || 'Отдел не указан'}
                            </div>
                          </div>
                          {user.id !== participant.id && (
                            <button
                              type="button"
                              className="secondary-btn"
                              onClick={() => handleRemoveParticipant(selectedGroup.chat.id, participant)}
                            >
                              Удалить
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>

                  <h5>Добавить участника</h5>
                  <select
                    className="field-input"
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddParticipant(selectedGroup.chat.id, e.target.value);
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">Выберите сотрудника</option>
                    {allUsers
                      .filter((u) => !selectedGroup.chat.participants.some((p) => p.id === u.id))
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.displayName || u.username} ({formatRole(u.role)})
                        </option>
                      ))}
                  </select>

                  {selectedGroup.chat.joinRequests?.length ? (
                    <>
                      <h5>Заявки на вступление</h5>
                      <ul className="search-list">
                        {selectedGroup.chat.joinRequests.map((req) => (
                          <li key={req.id}>
                            <div className="search-list__item">
                              <div>
                                <div className="search-list__name">{req.displayName || req.username}</div>
                                <div className="search-list__meta">{req.email}</div>
                              </div>
                              <div className="btn-row">
                                <button
                                  type="button"
                                  className="primary-btn"
                                  onClick={() => handleApprove(selectedGroup.chat.id, req)}
                                >
                                  Принять
                                </button>
                                <button
                                  type="button"
                                  className="secondary-btn"
                                  onClick={() => handleReject(selectedGroup.chat.id, req)}
                                >
                                  Отклонить
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="muted">Нет заявок</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderNewChatModal = () => {
    if (!newChatStep) return null;
    if (newChatStep === 'choice') return renderChoiceModal();
    if (newChatStep === 'direct') return renderDirectModal();
    if (newChatStep === 'group') return renderGroupModal();
    return null;
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
      }
      sidebar={
        <div className="sidebar">
          <div className="sidebar__top">
            <button type="button" className="primary-btn" onClick={() => setNewChatStep('choice')}>
              Новый чат
            </button>
          </div>
          <ChatList chats={chats} selectedChatId={selectedChatId} onSelect={setSelectedChat} />
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

      {renderNewChatModal()}
      {confirmState && (
        <ConfirmDialog
          text={confirmState.text}
          onConfirm={() => {
            confirmState.action();
            setConfirmState(null);
          }}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </Layout>
  );
};

export default ChatsPage;
