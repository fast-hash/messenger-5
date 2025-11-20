import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { formatRole } from '../utils/roleLabels';

const formatTime = (isoString) => {
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (error) {
    return '';
  }
};

const ChatWindow = ({ chat, messages, currentUserId, typingUsers, onToggleNotifications }) => {
  const listRef = useRef(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    setShowSettings(false);
  }, [chat.id]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const isOtherTyping = typingUsers?.includes(chat.otherUser?.id);
  const typingHint = isOtherTyping
    ? `Пользователь ${chat.otherUser?.displayName || chat.otherUser?.username || 'собеседник'} печатает...`
    : '';

  return (
    <div className="chat-window">
      <div className="chat-window__header">
        <div>
          <div className="chat-window__title">{chat.otherUser?.displayName || chat.otherUser?.username}</div>
          <div className="chat-window__meta">
            {formatRole(chat.otherUser?.role)} · {chat.otherUser?.department || 'Отдел не указан'} ·{' '}
            {chat.isOnline ? 'онлайн' : 'офлайн'}
          </div>
        </div>
        <div className="chat-window__actions">
          <button type="button" className="secondary-btn" onClick={() => setShowSettings((prev) => !prev)}>
            Настройки
          </button>
          {showSettings && (
            <div className="chat-window__settings">
              <label className="field inline">
                <input
                  type="checkbox"
                  checked={chat.notificationsEnabled}
                  onChange={() => onToggleNotifications(chat.id)}
                />
                Уведомления по этому чату
              </label>
              <p className="muted small">Настройки уведомлений — простой задел. Полноценные push/desktop/email будут описаны в дипломе.</p>
            </div>
          )}
        </div>
      </div>
      <div className="chat-window__messages" ref={listRef}>
        {messages.length === 0 && <p className="empty-state">Нет сообщений. Напишите первым.</p>}
        {messages.map((message) => {
          const isMine = message.senderId === currentUserId;
          return (
            <div key={message.id} className={`bubble ${isMine ? 'bubble--mine' : 'bubble--their'}`}>
              <div className="bubble__text">{message.text}</div>
              <div className="bubble__meta">{formatTime(message.createdAt)}</div>
            </div>
          );
        })}
      </div>
      {typingHint && <div className="typing-hint">{typingHint}</div>}
    </div>
  );
};

ChatWindow.propTypes = {
  chat: PropTypes.shape({
    id: PropTypes.string.isRequired,
    otherUser: PropTypes.object,
    isOnline: PropTypes.bool,
    notificationsEnabled: PropTypes.bool,
  }).isRequired,
  messages: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      chatId: PropTypes.string.isRequired,
      senderId: PropTypes.string.isRequired,
      text: PropTypes.string.isRequired,
      createdAt: PropTypes.string,
    })
  ).isRequired,
  currentUserId: PropTypes.string.isRequired,
  typingUsers: PropTypes.arrayOf(PropTypes.string),
  onToggleNotifications: PropTypes.func,
};

ChatWindow.defaultProps = {
  typingUsers: [],
  onToggleNotifications: () => {},
};

export default ChatWindow;
