import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { formatRole } from '../utils/roleLabels';
import { ensureNotificationPermission } from '../utils/notifications';
import { formatMessageDate } from '../utils/dateUtils';

const ChatWindow = ({
  chat,
  messages,
  currentUserId,
  typingUsers,
  onToggleNotifications,
  onOpenManage,
}) => {
  const listRef = useRef(null);
  const [showSettings, setShowSettings] = useState(false);
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState(null);

  useEffect(() => {
    setShowSettings(false);
    setFirstUnreadMessageId(null);
  }, [chat.id]);

  useEffect(() => {
    if (!chat) return;
    if (firstUnreadMessageId) return;

    const unreadCount = chat.unreadCount || 0;
    if (!unreadCount || !messages.length) return;

    const index = messages.length - unreadCount;
    if (index >= 0 && index < messages.length) {
      setFirstUnreadMessageId(messages[index].id || messages[index]._id);
    }
  }, [chat?.id, messages.length, firstUnreadMessageId]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const typingHint = useMemo(() => {
    if (chat.type === 'group') {
      if (typingUsers?.length) {
        const names = chat.participants
          ?.filter((p) => typingUsers.includes(p.id))
          .map((p) => p.displayName || p.username);
        if (names?.length) {
          return `${names.join(', ')} печатает...`;
        }
      }
      return '';
    }
    const isOtherTyping = typingUsers?.includes(chat.otherUser?.id);
    return isOtherTyping
      ? `Пользователь ${chat.otherUser?.displayName || chat.otherUser?.username || 'собеседник'} печатает...`
      : '';
  }, [chat.otherUser, chat.participants, chat.type, typingUsers]);

  const canManage =
    chat.type === 'group' &&
    (chat.createdBy === currentUserId || (chat.admins || []).includes(currentUserId));

  const headerTitle =
    chat.type === 'group'
      ? chat.title || 'Групповой чат'
      : chat.otherUser?.displayName || chat.otherUser?.username;
  const headerMeta =
    chat.type === 'group'
      ? `Участников: ${chat.participants?.length || 0}`
      : `${formatRole(chat.otherUser?.role)} · ${chat.otherUser?.department || 'Отдел не указан'} · ${chat.isOnline ? 'онлайн' : 'офлайн'}`;

  return (
    <div className="chat-window">
      <div className="chat-window__header">
        <div>
          <div className="chat-window__title">{headerTitle}</div>
          <div className="chat-window__meta">{headerMeta}</div>
        </div>
        <div className="chat-window__actions">
          {canManage && (
            <button type="button" className="secondary-btn" onClick={() => onOpenManage(chat.id)}>
              Управление
            </button>
          )}
          <button type="button" className="secondary-btn" onClick={() => setShowSettings((prev) => !prev)}>
            Настройки
          </button>
          {showSettings && (
            <div className="chat-window__settings">
              <label className="field inline">
                <input
                  type="checkbox"
                  checked={chat.notificationsEnabled}
                  onChange={async () => {
                    if (!chat.notificationsEnabled) {
                      await ensureNotificationPermission();
                    }
                    onToggleNotifications(chat.id);
                  }}
                />
                Получать уведомления по этому чату
              </label>
            </div>
          )}
        </div>
      </div>
      <div className="chat-window__messages" ref={listRef}>
        {messages.length === 0 && <p className="empty-state">Нет сообщений. Напишите первым.</p>}
        {messages.map((message, index) => {
          const isMine = message.senderId === currentUserId;
          const sender = message.sender || {};
          const authorName = sender.displayName || sender.username || 'Участник';
          const metaParts = [];
          const formattedRole = formatRole(sender.role);
          if (formattedRole) metaParts.push(formattedRole);
          if (sender.department) metaParts.push(sender.department);
          const authorMeta = metaParts.join(' · ');

          return (
            <div key={message.id}>
              {firstUnreadMessageId && (message.id === firstUnreadMessageId || message._id === firstUnreadMessageId) && (
                <div className="unread-separator">
                  <span>Непрочитанные сообщения</span>
                </div>
              )}
              <div className={`message-row ${isMine ? 'message-row--mine' : 'message-row--incoming'}`}>
                <div className="message-content">
                  <div className="message-author">
                    <span className="message-author__name">{authorName}</span>
                    {authorMeta && <span className="message-author__meta">{authorMeta}</span>}
                  </div>
                  <div className="message-text">{message.text}</div>
                </div>
                <div className="message-time">{formatMessageDate(message.createdAt)}</div>
              </div>
            </div>
          );
        })}
      </div>
      {chat.removed && chat.type === 'group' && (
        <div className="typing-hint warning">
          Вас удалили из этой группы. Вы можете просматривать историю, но отправка отключена.
        </div>
      )}
      {!chat.removed && typingHint && <div className="typing-hint">{typingHint}</div>}
    </div>
  );
};

ChatWindow.propTypes = {
  chat: PropTypes.shape({
    id: PropTypes.string.isRequired,
    otherUser: PropTypes.object,
    isOnline: PropTypes.bool,
    notificationsEnabled: PropTypes.bool,
    type: PropTypes.string,
    title: PropTypes.string,
    participants: PropTypes.array,
    removed: PropTypes.bool,
    createdBy: PropTypes.string,
    admins: PropTypes.arrayOf(PropTypes.string),
    lastReadAt: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  }).isRequired,
  messages: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      chatId: PropTypes.string.isRequired,
      senderId: PropTypes.string.isRequired,
      sender: PropTypes.object,
      text: PropTypes.string.isRequired,
      createdAt: PropTypes.string,
    })
  ).isRequired,
  currentUserId: PropTypes.string.isRequired,
  typingUsers: PropTypes.arrayOf(PropTypes.string),
  onToggleNotifications: PropTypes.func,
  onOpenManage: PropTypes.func,
};

ChatWindow.defaultProps = {
  typingUsers: [],
  onToggleNotifications: () => {},
  onOpenManage: () => {},
};

export default ChatWindow;
