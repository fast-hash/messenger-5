import httpClient from './httpClient';

export const getChats = async () => {
  const { data } = await httpClient.get('/api/chats');
  return data;
};

export const createDirectChat = async (payload) => {
  const { data } = await httpClient.post('/api/chats', payload);
  return data;
};
