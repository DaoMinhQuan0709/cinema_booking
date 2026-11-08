import { useState } from 'react';
import { Film } from 'lucide-react';

export const MovieImage = ({ src, fallbackSrc, alt = '', className = '', loading }) => {
  const [failedSources, setFailedSources] = useState([]);
  const source = [src, fallbackSrc].find(value => value && !failedSources.includes(value));

  return source ? (
    <img
      src={source}
      alt={alt}
      loading={loading}
      className={className}
      onError={() => setFailedSources(previous => [...previous, source])}
    />
  ) : (
    <div role={alt ? 'img' : undefined} aria-label={alt || undefined} className={`flex items-center justify-center bg-surface text-muted ${className}`}>
      <Film aria-hidden="true" className="h-12 w-12" strokeWidth={1} />
    </div>
  );
};
