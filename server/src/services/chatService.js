const Chat = require('../models/Chat');
const User = require('../models/User');
const Message = require('../models/Message');

const buildParticipantsKey = (userIdA, userIdB) => {
  const [first, second] = [userIdA.toString(), userIdB.toString()].sort();
  return `${first}:${second}`;
};

const mapUser = (user) => ({
  id: user._id ? user._id.toString() : user.toString(),
  username: user.username,
  email: user.email,
  displayName: user.displayName,
  role: user.role,
  department: user.department,
  jobTitle: user.jobTitle,
});

const findReadState = (chatDoc, userId) =>
  (chatDoc.readState || []).find((entry) => entry.user && entry.user.toString() === userId.toString());

const toChatDto = (chatDoc, currentUserId) => ({
  id: chatDoc._id.toString(),
  type: chatDoc.type || 'direct',
  title: chatDoc.type === 'group' ? chatDoc.title : null,
  createdBy: chatDoc.createdBy ? chatDoc.createdBy.toString() : null,
  admins: (chatDoc.admins || []).map((admin) =>
    admin._id ? admin._id.toString() : admin.toString()
  ),
  participants: (chatDoc.participants || []).map(mapUser),
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
  removed:
    currentUserId && (chatDoc.removedFor || []).some((id) => id.toString() === currentUserId.toString()),
  notificationsEnabled: chatDoc.notificationsEnabled !== false,
  lastReadAt: currentUserId ? findReadState(chatDoc, currentUserId)?.lastReadAt || null : null,
});

const computeUnreadCount = async (chat, userId) => {
  const state = (chat.readState || []).find((entry) => entry.user && entry.user.toString() === userId.toString());
  const lastReadAt = state ? state.lastReadAt : null;

  if (!lastReadAt) {
    return Message.countDocuments({ chat: chat._id });
  }

  return Message.countDocuments({ chat: chat._id, createdAt: { $gt: lastReadAt } });
};

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

  let chat = await Chat.findOne({ participantsKey, type: 'direct' }).populate('participants');

  if (!chat) {
    chat = await Chat.create({
      type: 'direct',
      participants: [userId, otherUserId],
      participantsKey,
    });
    await chat.populate('participants');
  }

  return toChatDto(chat, userId);
};

const getUserChats = async ({ userId }) => {
  const chats = await Chat.find({ $or: [{ participants: userId }, { removedFor: userId }] })
    .sort({ updatedAt: -1 })
    .populate('participants')
    .populate('admins');

  const withUnread = await Promise.all(
    chats.map(async (chat) => {
      const dto = toChatDto(chat, userId);
      dto.unreadCount = await computeUnreadCount(chat, userId);
      return dto;
    })
  );

  return withUnread;
};

const createGroupChat = async ({ title, creatorId, participantIds = [] }) => {
  if (!title || !title.trim()) {
    const error = new Error('Название группы обязательно');
    error.status = 400;
    throw error;
  }

  const creator = await User.findById(creatorId);
  if (!creator || creator.role !== 'admin') {
    const error = new Error('Создавать группы может только администратор');
    error.status = 403;
    throw error;
  }

  const allParticipants = Array.from(
    new Set([creatorId, ...(participantIds || []).map((id) => id.toString())])
  );

  const chat = await Chat.create({
    type: 'group',
    title: title.trim(),
    createdBy: creatorId,
    admins: [creatorId],
    participants: allParticipants,
    joinRequests: [],
    removedFor: [],
  });

  await chat.populate('participants').populate('admins');
  return {
    chat: toChatDto(chat, creatorId),
    isAdmin: true,
  };
};

const listGroupsForUser = async ({ userId }) => {
  const groups = await Chat.find({ type: 'group' })
    .populate('participants')
    .populate('admins');

  return groups.map((group) => {
    const isAdmin = group.admins.some((id) => id.toString() === userId.toString());
    const isMember = group.participants.some((id) => id.toString() === userId.toString());
    const isPending = (group.joinRequests || []).some(
      (req) => req.user && req.user.toString() === userId.toString()
    );

    let membershipStatus = 'none';
    if (group.createdBy && group.createdBy.toString() === userId.toString()) membershipStatus = 'owner';
    else if (isAdmin) membershipStatus = 'admin';
    else if (isMember) membershipStatus = 'member';
    else if (isPending) membershipStatus = 'pending';

    return {
      id: group._id.toString(),
      type: 'group',
      title: group.title,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      participantsCount: group.participants.length,
      membershipStatus,
    };
  });
};

const mapJoinRequest = (request) => {
  if (!request || !request.user) return null;
  const base = mapUser(request.user);
  return { ...base, createdAt: request.createdAt };
};

const getGroupDetails = async ({ chatId, userId }) => {
  const chat = await Chat.findById(chatId)
    .populate('participants')
    .populate('admins')
    .populate('joinRequests.user');

  if (!chat || chat.type !== 'group') {
    const error = new Error('Группа не найдена');
    error.status = 404;
    throw error;
  }

  const canManage =
    chat.admins.some((id) => id.toString() === userId.toString()) ||
    (chat.createdBy && chat.createdBy.toString() === userId.toString());

  if (!canManage) {
    const error = new Error('Недостаточно прав для управления группой');
    error.status = 403;
    throw error;
  }

  return {
    chat: {
      ...toChatDto(chat, userId),
      joinRequests: (chat.joinRequests || []).map(mapJoinRequest).filter(Boolean),
    },
    canManage,
  };
};

const ensureGroupAdmin = (chat, adminId) => {
  const isAdmin =
    (chat.admins || []).some((id) => id.toString() === adminId.toString()) ||
    (chat.createdBy && chat.createdBy.toString() === adminId.toString());
  if (!isAdmin) {
    const error = new Error('Требуются права администратора группы');
    error.status = 403;
    throw error;
  }
};

const groupAddParticipant = async ({ chatId, adminId, userId }) => {
  const chat = await Chat.findById(chatId)
    .populate('participants')
    .populate('admins')
    .populate('joinRequests.user');
  if (!chat || chat.type !== 'group') {
    const error = new Error('Группа не найдена');
    error.status = 404;
    throw error;
  }

  ensureGroupAdmin(chat, adminId);

  const joinRequests = (chat.joinRequests || []).filter(
    (req) => req.user && req.user.toString() !== userId.toString()
  );
  const participants = Array.from(
    new Set([...chat.participants.map((p) => p.toString()), userId.toString()])
  );

  chat.joinRequests = joinRequests;
  chat.participants = participants;
  await chat.save();
  await chat.populate('participants').populate('admins').populate('joinRequests.user');

  return { ok: true, ...(await getGroupDetails({ chatId, userId: adminId })) };
};

const groupRemoveParticipant = async ({ chatId, adminId, userId }) => {
  const chat = await Chat.findById(chatId)
    .populate('participants')
    .populate('admins')
    .populate('joinRequests.user');
  if (!chat || chat.type !== 'group') {
    const error = new Error('Группа не найдена');
    error.status = 404;
    throw error;
  }

  ensureGroupAdmin(chat, adminId);

  if (adminId.toString() === userId.toString()) {
    const error = new Error('Нельзя удалить себя');
    error.status = 400;
    throw error;
  }

  chat.participants = chat.participants.filter((p) => p.toString() !== userId.toString());
  chat.removedFor = Array.from(new Set([...(chat.removedFor || []).map((id) => id.toString()), userId.toString()]));
  await chat.save();
  await chat.populate('participants').populate('admins').populate('joinRequests.user');

  return { ok: true, ...(await getGroupDetails({ chatId, userId: adminId })) };
};

const groupRename = async ({ chatId, adminId, title }) => {
  if (!title || !title.trim()) {
    const error = new Error('Название группы обязательно');
    error.status = 400;
    throw error;
  }

  const chat = await Chat.findById(chatId).populate('admins');
  if (!chat || chat.type !== 'group') {
    const error = new Error('Группа не найдена');
    error.status = 404;
    throw error;
  }

  ensureGroupAdmin(chat, adminId);
  chat.title = title.trim();
  await chat.save();

  await chat.populate('participants');
  return getGroupDetails({ chatId, userId: adminId });
};

const groupRequestJoin = async ({ chatId, userId }) => {
  const chat = await Chat.findById(chatId);
  if (!chat || chat.type !== 'group') {
    const error = new Error('Группа не найдена');
    error.status = 404;
    throw error;
  }

  const alreadyParticipant = chat.participants.some((p) => p.toString() === userId.toString());
  if (alreadyParticipant) {
    return { ok: true, status: 'member' };
  }

  const alreadyPending = (chat.joinRequests || []).some(
    (req) => req.user && req.user.toString() === userId.toString()
  );
  if (alreadyPending) {
    return { ok: true, status: 'already_requested' };
  }

  chat.joinRequests = [...(chat.joinRequests || []), { user: userId }];
  await chat.save();

  return { ok: true, status: 'requested' };
};

const groupApproveRequest = async ({ chatId, adminId, userId }) => {
  const chat = await Chat.findById(chatId).populate('admins');
  if (!chat || chat.type !== 'group') {
    const error = new Error('Группа не найдена');
    error.status = 404;
    throw error;
  }

  ensureGroupAdmin(chat, adminId);

  chat.joinRequests = (chat.joinRequests || []).filter(
    (req) => req.user && req.user.toString() !== userId.toString()
  );
  chat.participants = Array.from(
    new Set([...(chat.participants || []).map((p) => p.toString()), userId.toString()])
  );
  await chat.save();

  return getGroupDetails({ chatId, userId: adminId });
};

const groupRejectRequest = async ({ chatId, adminId, userId }) => {
  const chat = await Chat.findById(chatId).populate('admins');
  if (!chat || chat.type !== 'group') {
    const error = new Error('Группа не найдена');
    error.status = 404;
    throw error;
  }

  ensureGroupAdmin(chat, adminId);
  chat.joinRequests = (chat.joinRequests || []).filter(
    (req) => req.user && req.user.toString() !== userId.toString()
  );
  await chat.save();

  return getGroupDetails({ chatId, userId: adminId });
};

const markChatRead = async ({ chatId, userId }) => {
  const chat = await Chat.findById(chatId);
  if (!chat) {
    const error = new Error('Чат не найден');
    error.status = 404;
    throw error;
  }

  const now = new Date();
  const existing = (chat.readState || []).find((entry) => entry.user && entry.user.toString() === userId.toString());

  if (existing) {
    existing.lastReadAt = now;
  } else {
    chat.readState.push({ user: userId, lastReadAt: now });
  }

  await chat.save();
  return { ok: true, lastReadAt: now };
};

module.exports = {
  getOrCreateDirectChat,
  getUserChats,
  createGroupChat,
  listGroupsForUser,
  getGroupDetails,
  groupAddParticipant,
  groupRemoveParticipant,
  groupRename,
  groupRequestJoin,
  groupApproveRequest,
  groupRejectRequest,
  markChatRead,
};
