import { CalendarDays, ChevronRight, Film, Ticket } from 'lucide-react';

const suggestions = [
  {
    id: 'movies',
    question: 'Hôm nay có những phim nào đang chiếu?',
    Icon: Film,
  },
  {
    id: 'showtimes',
    question: 'Có suất chiếu nào sau 20 giờ hôm nay không?',
    Icon: CalendarDays,
  },
  {
    id: 'prices',
    question: 'Giá vé xem phim hiện tại là bao nhiêu?',
    Icon: Ticket,
  },
];

export const ChatSuggestions = ({ onSelect }) => (
  <section aria-labelledby="cinebot-suggestions-title" className="space-y-2.5">
    <h3 id="cinebot-suggestions-title" className="text-xs font-semibold text-muted">
      Gợi ý cho bạn
    </h3>
    <ul className="space-y-2">
      {suggestions.map(({ id, question, Icon }) => (
        <li key={id}>
          <button
            type="button"
            onClick={() => onSelect(question)}
            className="group flex min-h-11 w-full items-center gap-3 rounded-xl border border-surfaceBorder bg-background px-3 py-3 text-left text-sm leading-relaxed text-neutral-200 transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon aria-hidden="true" className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 break-words">{question}</span>
            <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted group-hover:text-primary" />
          </button>
        </li>
      ))}
    </ul>
  </section>
);

export default ChatSuggestions;
