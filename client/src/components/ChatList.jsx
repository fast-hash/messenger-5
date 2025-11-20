import PropTypes from 'prop-types';

const formatTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ChatList = ({ chats, selectedChatId, onSelect }) => {
  if (!chats.length) {
    return <p className="empty-state">Чатов пока нет. Создайте первый.</p>;
  }

  return (
    <ul className="chat-list">
      {chats.map((chat) => {
        const isActive = chat.id === selectedChatId;
        const lastMessage = chat.lastMessage?.text || 'Нет сообщений';
        const lastTime = chat.lastMessage?.createdAt ? formatTime(chat.lastMessage.createdAt) : '';
        return (
          <li key={chat.id}>
            <button
              type="button"
              className={`chat-list__item ${isActive ? 'chat-list__item--active' : ''}`}
              onClick={() => onSelect(chat.id)}
            >
              <div className="chat-list__avatar">
                <span className={chat.isOnline ? 'status status--online' : 'status status--offline'} />
              </div>
              <div className="chat-list__body">
                <div className="chat-list__top">
                  <div>
                    <div className="chat-list__title">{chat.otherUser?.displayName || chat.otherUser?.username}</div>
                    <div className="chat-list__meta">
                      {chat.otherUser?.role || 'staff'} · {chat.otherUser?.department || 'Отдел не указан'}
                    </div>
                  </div>
                  <span className="chat-list__time">{lastTime}</span>
                </div>
                <div className="chat-list__last">{lastMessage}</div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

ChatList.propTypes = {
  chats: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      otherUser: PropTypes.object,
      lastMessage: PropTypes.shape({
        text: PropTypes.string,
        senderId: PropTypes.string,
        createdAt: PropTypes.string,
      }),
      updatedAt: PropTypes.string,
      isOnline: PropTypes.bool,
    })
  ).isRequired,
  selectedChatId: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
};

ChatList.defaultProps = {
  selectedChatId: null,
};

export default ChatList;
