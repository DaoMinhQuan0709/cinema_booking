import { Lock } from 'lucide-react';

const ITEMS = [
  { label: 'Thường', box: 'bg-seat-standard' },
  { label: 'VIP', box: 'bg-seat-vip' },
  { label: 'Ghế đôi (2 chỗ)', box: 'bg-seat-couple', double: true },
  { label: 'Đang chọn', box: 'bg-seat-selected shadow-[0_0_8px_rgba(229,9,20,0.7)]' },
  { label: 'Người khác đang giữ', box: 'bg-seat-locked/70', icon: true },
  { label: 'Đã bán', box: 'bg-seat-booked border border-surfaceBorder' },
];

/** Chu thich mau ghe. Mau lay tu token seat.* trong tailwind.config.js. */
export const SeatLegend = ({ hasOwnHold = false }) => (
  <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-neutral-300">
    {ITEMS.map((item) => (
      <li key={item.label} className="inline-flex items-center gap-2">
        <span className={`flex h-5 ${item.double ? 'w-10' : 'w-5'} items-center justify-center rounded-t-md rounded-b-sm ${item.box}`}>
          {item.icon && <Lock className="h-3 w-3 text-white/90" />}
        </span>
        {item.label}
      </li>
    ))}
    {hasOwnHold && <li className="inline-flex items-center gap-2"><span className="h-5 w-5 rounded-t-md rounded-b-sm bg-seat-selected ring-2 ring-white/60" />Đang giữ cho bạn</li>}
  </ul>
);

export default SeatLegend;
