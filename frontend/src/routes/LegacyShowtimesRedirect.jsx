import { Navigate, useSearchParams } from 'react-router-dom';
import { getLegacyShowtimesHref } from './legacyShowtimes.js';

export default function LegacyShowtimesRedirect() {
  const [params] = useSearchParams();
  return <Navigate to={getLegacyShowtimesHref(params)} replace />;
}
