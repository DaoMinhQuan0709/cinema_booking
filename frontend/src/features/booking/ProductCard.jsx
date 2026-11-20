import { Minus, Plus } from 'lucide-react';
import { formatCurrency } from '../../utils/formatCurrency';
import ProductImage from './ProductImage';

const quantityButton = 'flex min-h-11 min-w-11 items-center justify-center rounded-lg text-neutral-200 hover:bg-surfaceBorder disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';

export default function ProductCard({ product, quantity, disabled, onChange }) {
  const available = product.isAvailable !== false;
  return <article className={`flex h-full flex-col overflow-hidden rounded-2xl border ${quantity ? 'border-primary/60 bg-primary/5' : 'border-surfaceBorder bg-surface/60'}`}>
    <div className="relative flex h-40 items-center justify-center bg-black/15 p-4 sm:h-44"><ProductImage src={product.imageUrl} />{quantity > 0 && <span className="absolute right-3 top-3 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-white">Đã chọn {quantity}</span>}</div>
    <div className="flex flex-1 flex-col p-4 sm:p-5">
      <h3 className="text-lg font-bold text-white">{product.name}</h3>
      <p className={`mt-2 text-sm leading-relaxed ${available ? 'text-muted' : 'text-amber-300'}`}>{available ? product.description : 'Sản phẩm đã ngừng bán. Vui lòng bỏ khỏi đơn.'}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5"><strong className="text-base text-white">{formatCurrency(product.price)}</strong>
        <div className="flex items-center rounded-xl border border-surfaceBorder bg-background">
          <button type="button" aria-label={`Giảm ${product.name}`} className={quantityButton} disabled={disabled || quantity === 0} onClick={() => onChange(quantity - 1)}><Minus className="h-4 w-4" aria-hidden="true" /></button>
          <output aria-label={`Số lượng ${product.name}`} aria-live="polite" className="min-w-7 text-center text-sm font-semibold tabular-nums text-white">{quantity}</output>
          <button type="button" aria-label={`Tăng ${product.name}`} className={quantityButton} disabled={disabled || !available || quantity >= 2147483647} onClick={() => onChange(quantity + 1)}><Plus className="h-4 w-4" aria-hidden="true" /></button>
        </div>
      </div>
    </div>
  </article>;
}
