const Chat = require('../models/Chat');

const buildParticipantsKey = (userIdA, userIdB) => {
  const [first, second] = [userIdA.toString(), userIdB.toString()].sort();
  return `${first}:${second}`;
};

const toChatDto = (chatDoc) => ({
  id: chatDoc._id.toString(),
  participants: chatDoc.participants.map((participant) => ({
    id: participant._id ? participant._id.toString() : participant.toString(),
    username: participant.username,
    email: participant.email,
    displayName: participant.displayName,
    role: participant.role,
    department: participant.department,
    jobTitle: participant.jobTitle,
  })),
  createdAt: chatDoc.createdAt,
  lastMessage: chatDoc.lastMessage
    ? {
        text: chatDoc.lastMessage.text,
        senderId: chatDoc.lastMessage.sender
          ? chatDoc.lastMessage.sender.toString()
          : null,
        createdAt: chatDoc.lastMessage.createdAt,
      }
    : null,
  updatedAt: chatDoc.updatedAt,
});

const getOrCreateDirectChat = async ({ userId, otherUserId }) => {
  if (!userId || !otherUserId) {
    const error = new Error('Both userId and otherUserId are required');
    error.status = 400;
    throw error;
  }

  if (userId.toString() === otherUserId.toString()) {
    const error = new Error('Cannot create chat with yourself');
    error.status = 400;
    throw error;
  }

  const participantsKey = buildParticipantsKey(userId, otherUserId);

  let chat = await Chat.findOne({ participantsKey }).populate('participants');

  if (!chat) {
    chat = await Chat.create({
      participants: [userId, otherUserId],
      participantsKey,
    });
    await chat.populate('participants');
  }

  return toChatDto(chat);
};

const getUserChats = async ({ userId }) => {
  const chats = await Chat.find({ participants: userId })
    .sort({ updatedAt: -1 })
    .populate('participants');

  return chats.map(toChatDto);
};

module.exports = {
  getOrCreateDirectChat,
  getUserChats,
};
