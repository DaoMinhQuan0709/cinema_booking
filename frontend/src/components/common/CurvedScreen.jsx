import { useId } from 'react';

/**
 * Man hinh chieu cong (SVG) voi vet sang do xuong khu vuc ghe.
 * Duong cong lom ve phia khan gia, khop voi cac hang ghe uon quanh man hinh.
 */
export const CurvedScreen = () => {
  const id = useId();
  return (
    <div className="relative mx-auto w-full max-w-3xl select-none pt-5" aria-label="Màn hình chiếu" role="img">
      <svg viewBox="0 0 800 110" className="h-auto w-full" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-stroke`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#E50914" stopOpacity="0" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#E50914" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}-beam`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E50914" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#E50914" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Vet sang tren ghe */}
        <path d="M40 62 Q400 -6 760 62 L840 112 L-40 112 Z" fill={`url(#${id}-beam)`} />
        {/* Than man hinh */}
        <path
          d="M40 62 Q400 -6 760 62"
          fill="none"
          stroke={`url(#${id}-stroke)`}
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
      <p className="absolute inset-x-0 top-0 text-center text-[11px] font-semibold uppercase tracking-[0.5em] text-neutral-400">
        Màn hình
      </p>
    </div>
  );
};

export default CurvedScreen;

