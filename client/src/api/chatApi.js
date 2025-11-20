import httpClient from './httpClient';

export const getChats = async () => {
  const { data } = await httpClient.get('/api/chats');
  return data;
};

export const createDirectChat = async (payload) => {
  const { data } = await httpClient.post('/api/chats', payload);
  return data;
};

export const createGroupChat = async (payload) => {
  const { data } = await httpClient.post('/api/chats/group', payload);
  return data;
};

export const listGroups = async () => {
  const { data } = await httpClient.get('/api/chats/groups');
  return data;
};

export const getGroupDetails = async (chatId) => {
  const { data } = await httpClient.get(`/api/chats/${chatId}/participants`);
  return data;
};

export const addParticipant = async (chatId, userId) => {
  const { data } = await httpClient.post(`/api/chats/${chatId}/participants`, { userId });
  return data;
};

export const removeParticipant = async (chatId, userId) => {
  const { data } = await httpClient.delete(`/api/chats/${chatId}/participants/${userId}`);
  return data;
};

export const renameGroup = async (chatId, title) => {
  const { data } = await httpClient.patch(`/api/chats/${chatId}`, { title });
  return data;
};

export const requestJoin = async (chatId) => {
  const { data } = await httpClient.post(`/api/chats/${chatId}/join-request`);
  return data;
};

export const approveJoin = async (chatId, userId) => {
  const { data } = await httpClient.post(`/api/chats/${chatId}/join-requests/${userId}/approve`);
  return data;
};

export const rejectJoin = async (chatId, userId) => {
  const { data } = await httpClient.post(`/api/chats/${chatId}/join-requests/${userId}/reject`);
  return data;
};

export const markChatRead = async (chatId) => {
  const { data } = await httpClient.post(`/api/chats/${chatId}/read`);
  return data;
};
