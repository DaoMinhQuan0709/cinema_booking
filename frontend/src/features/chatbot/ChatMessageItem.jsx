import { lazy, Suspense } from 'react';
import { Bot } from 'lucide-react';

// Chi tai bo render Markdown khi CineBot tra ve cau tra loi dau tien.
const ChatMarkdown = lazy(() => import('./ChatMarkdown'));

export default function ChatMessageItem({ message }) {
  const isUser = message.role === 'user';

  return (
    <article aria-label={isUser ? 'Bạn' : 'CineBot'} className={`flex items-start gap-2.5 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Bot aria-hidden="true" className="h-4 w-4" />
        </div>
      )}
      <div className={`min-w-0 max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed [overflow-wrap:anywhere] ${
        isUser
          ? 'rounded-tr-sm bg-primary text-white'
          : 'rounded-tl-sm border border-surfaceBorder bg-background text-neutral-200'
      }`}>
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.text}</p>
        ) : (
          <Suspense fallback={<p className="whitespace-pre-wrap">{message.text}</p>}>
            <ChatMarkdown text={message.text} />
          </Suspense>
        )}
      </div>
    </article>
  );
}
