import { useEffect, useRef, useState } from 'react';
import chatService from '../../services/chatService';

export const useCineBot = () => {
  const [draftMessage, setDraftMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef(null);
  const nextMessageId = useRef(0);

  useEffect(() => () => requestRef.current?.abort(), []);

  const sendMessage = async () => {
    const text = draftMessage.trim();
    // Ref chan ca hai lan submit xay ra truoc khi React render lai.
    if (!text || requestRef.current) return;

    const controller = new AbortController();
    const userMessage = { id: ++nextMessageId.current, role: 'user', text };
    // Chi gom cac luot truoc; backend tu them cau hoi hien tai vao Gemini contents.
    const conversationHistory = messages.map(({ role, text }) => ({ role, text }));
    requestRef.current = controller;
    setIsSending(true);
    setError('');
    setDraftMessage('');
    setMessages(previous => [...previous, userMessage]);

    try {
      const { reply } = await chatService.ask(text, conversationHistory, { signal: controller.signal });
      if (controller.signal.aborted) return;

      const response = { id: ++nextMessageId.current, role: 'model', text: reply };
      setMessages(previous => [...previous, response]);
    } catch (requestError) {
      if (controller.signal.aborted) return;

      // Khoi phuc cau hoi de nguoi dung gui lai; khong dua luot loi vao lich su.
      setMessages(previous => previous.filter(message => message.id !== userMessage.id));
      setDraftMessage(previous => previous || text);
      const timedOut = ['ECONNABORTED', 'ETIMEDOUT'].includes(requestError.code);
      setError(timedOut
        ? 'CineBot trả lời lâu hơn dự kiến. Bạn có thể gửi lại câu hỏi.'
        : 'Chưa nhận được câu trả lời. Bạn có thể gửi lại câu hỏi.');
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        if (!controller.signal.aborted) setIsSending(false);
      }
    }
  };

  return { draftMessage, setDraftMessage, messages, isSending, error, sendMessage };
};
