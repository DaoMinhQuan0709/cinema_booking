import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const components = {
  a: ({ href, children }) => href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
  ) : <span>{children}</span>,
  table: ({ children }) => (
    <div className="max-w-full overflow-x-auto" tabIndex={0} role="region" aria-label="Bảng thông tin CineBot">
      <table>{children}</table>
    </div>
  ),
};

export default function ChatMarkdown({ text }) {
  return (
    <div className="space-y-2 [overflow-wrap:anywhere] [&_a]:text-white [&_a]:underline [&_a]:decoration-primary [&_a]:underline-offset-2 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/50 [&_blockquote]:pl-3 [&_blockquote]:text-muted [&_code]:rounded [&_code]:bg-white/5 [&_code]:px-1 [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-bold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:whitespace-pre-wrap [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-white/5 [&_pre]:p-2 [&_strong]:font-semibold [&_strong]:text-white [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_td]:border [&_td]:border-surfaceBorder [&_td]:p-2 [&_th]:border [&_th]:border-surfaceBorder [&_th]:p-2 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-5">
      <Markdown remarkPlugins={[remarkGfm]} components={components} skipHtml disallowedElements={['img']}>
        {text}
      </Markdown>
    </div>
  );
}
