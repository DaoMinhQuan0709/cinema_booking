import axiosInstance from '../config/axiosInstance';

export const chatService = {
  ask: async (message, conversationHistory = [], { signal } = {}) => {
    const { data } = await axiosInstance.post('/chat/ask', {
      message,
      conversationHistory,
    }, {
      signal,
      timeout: 60000,
      skipErrorToast: true,
    });

    if (typeof data?.reply !== 'string' || !data.reply.trim()) {
      throw new Error('CineBot chưa nhận được câu trả lời hợp lệ.');
    }

    return { ...data, reply: data.reply.trim() };
  },
};

export default chatService;
