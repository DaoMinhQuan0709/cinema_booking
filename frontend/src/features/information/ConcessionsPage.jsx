import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check, Popcorn, RefreshCw } from 'lucide-react';
import { productService } from '../../services/productService';
import { formatCurrency } from '../../utils/formatCurrency';
import ProductImage from '../booking/ProductImage';
import InformationLayout from './InformationLayout';

export default function ConcessionsPage() {
  const query = useQuery({ queryKey: ['products'], queryFn: ({ signal }) => productService.getProducts(signal), staleTime: 60_000 });
  const products = (query.data ?? []).filter(product => product.isAvailable !== false);

  return <InformationLayout number="06" wide eyebrow="Thêm vị cho buổi chiếu" title="Bắp nước & combo" description="Một phần bắp giòn, một ngụm nước mát. Khám phá món đồng hành cho bộ phim tiếp theo của bạn.">
    <section className="concessions-intro" aria-labelledby="concessions-intro-title"><div><p className="information-eyebrow">TỪ MÀN ẢNH ĐẾN VỊ GIÁC</p><h2 id="concessions-intro-title">Phim hay.<br />Thêm <span>trọn vị.</span></h2><p>Chọn bắp nước ngay trong lúc đặt vé. Mọi sản phẩm đã chọn sẽ có trong chi tiết đơn để bạn kiểm tra trước khi thanh toán.</p><Link className="information-button" to="/movies">Chọn phim & đặt vé<ArrowRight size={17} aria-hidden="true" /></Link></div><div className="concessions-art" aria-hidden="true"><span className="concessions-art-ring" /><Popcorn strokeWidth={1} /><span className="concessions-art-caption">ENJOY EVERY SCENE</span></div></section>
    <section className="concessions-catalog" aria-labelledby="concessions-catalog-title"><div className="concessions-catalog-header"><div><p className="information-eyebrow">DÀNH CHO BUỔI CHIẾU CỦA BẠN</p><h2 id="concessions-catalog-title">Thực đơn bắp nước</h2></div><span>{query.isPending ? 'Đang tải thực đơn…' : `${products.length} lựa chọn`}</span></div>
      {query.isPending && <div className="concessions-grid" role="status"><span className="sr-only">Đang tải bắp nước và combo…</span>{[0, 1, 2].map(item => <div key={item} className="concession-skeleton" aria-hidden="true"><div /><span /><span /></div>)}</div>}
      {query.isError && <div className="information-empty" role="alert"><RefreshCw size={30} aria-hidden="true" /><h3>Chưa tải được thực đơn</h3><p>Vui lòng kiểm tra kết nối và thử lại để xem danh mục mới nhất.</p><button type="button" className="information-button" disabled={query.isFetching} onClick={() => query.refetch()}>{query.isFetching ? 'Đang tải…' : 'Thử lại'}</button></div>}
      {!query.isPending && !query.isError && products.length === 0 && <div className="information-empty"><Popcorn size={32} aria-hidden="true" /><h3>Thực đơn đang được cập nhật</h3><p>Bạn vẫn có thể chọn phim và đặt vé mà không kèm bắp nước.</p><Link className="information-text-link" to="/movies">Khám phá phim<ArrowRight size={16} aria-hidden="true" /></Link></div>}
      {!query.isPending && products.length > 0 && <div className="concessions-grid">{products.map((product, index) => <article className="concession-card" key={product.id}><div className="concession-image"><span className="concession-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><ProductImage src={product.imageUrl} /></div><div className="concession-copy"><h3>{product.name}</h3><p>{product.description || 'Thêm vào đơn sau bước chọn ghế.'}</p><div><strong>{formatCurrency(product.price)}</strong><span>Chọn khi đặt vé</span></div></div></article>)}</div>}
      <p className="concessions-price-note">Giá và tình trạng sản phẩm được kiểm tra lại khi cập nhật đơn. Hãy xác nhận tổng tiền ở bước thanh toán.</p>
    </section>
    <section className="concessions-how" aria-labelledby="concessions-how-title"><div><p className="information-eyebrow">THẬT DỄ ĐỂ THÊM MÓN</p><h2 id="concessions-how-title">Ba bước, đủ vị.</h2><p><Check size={16} aria-hidden="true" />Không bắt buộc mua kèm vé</p></div><ol>{[['Chọn phim & ghế', 'Giữ chỗ cho suất chiếu bạn yêu thích.'], ['Thêm bắp nước', 'Chọn sản phẩm và số lượng trong đơn.'], ['Kiểm tra & thanh toán', 'Xác nhận tổng tiền trước khi hoàn tất.']].map(([title, text], index) => <li key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p></li>)}</ol></section>
  </InformationLayout>;
}
