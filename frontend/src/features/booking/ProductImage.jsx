import { useState } from 'react';
import { Popcorn } from 'lucide-react';
import { API_BASE_URL } from '../../config/constants';
import { productImageUrl } from '../../utils/productImageUrl';

export default function ProductImage({ src }) {
  const source = productImageUrl(src, API_BASE_URL);
  const [failedSource, setFailedSource] = useState(null);
  return source && source !== failedSource
    ? <img src={source} alt="" className="h-full w-full object-contain" loading="lazy" onError={() => setFailedSource(source)} />
    : <Popcorn className="h-10 w-10 text-muted" aria-hidden="true" />;
}
