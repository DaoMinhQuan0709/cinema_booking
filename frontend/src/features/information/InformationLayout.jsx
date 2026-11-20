import { useEffect, useRef } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Mail, Ticket } from 'lucide-react';
import { informationLinks } from './informationContent';
import './information.css';

export default function InformationLayout({ number, eyebrow, title, description, children, wide = false }) {
  const { pathname, hash } = useLocation();
  const navigationRef = useRef(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} | PremierCinema`;
    const navigation = navigationRef.current;
    const activeLink = navigation?.querySelector('[aria-current="page"]');
    if (activeLink && navigation.scrollWidth > navigation.clientWidth) {
      navigation.scrollLeft += activeLink.getBoundingClientRect().left - navigation.getBoundingClientRect().left - (navigation.clientWidth - activeLink.offsetWidth) / 2;
    }
    if (hash) {
      let id;
      try { id = decodeURIComponent(hash.slice(1)); } catch { id = ''; }
      document.getElementById(id)?.scrollIntoView({ block: 'start' });
    } else window.scrollTo(0, 0);
    return () => { document.title = previousTitle; };
  }, [title, pathname, hash]);

  return <div className="information-page">
    <nav aria-label="Đường dẫn" className="information-breadcrumb">
      <Link to="/">Trang chủ</Link><ArrowRight size={12} aria-hidden="true" /><span aria-current="page">{title}</span>
    </nav>
    <header className="information-hero">
      <div>
        <p className="information-eyebrow">PREMIERCINEMA <span aria-hidden="true">/</span> {eyebrow}</p>
        <h1>{title}<span className="information-period">.</span></h1>
        <p className="information-description">{description}</p>
      </div>
      <div className="information-edition" aria-hidden="true"><span>CẨM NANG ĐIỆN ẢNH</span><strong>{number}</strong><span>TRƯỚC GIỜ ĐÈN TẮT</span></div>
    </header>
    <div className={wide ? 'information-body information-body-wide' : 'information-body'}>
      {!wide && <aside className="information-sidebar">
        <nav ref={navigationRef} aria-label="Thông tin và hỗ trợ">
          <p className="information-nav-label">Thông tin & hỗ trợ</p>
          {informationLinks.map(item => <NavLink key={item.to} to={item.to} className={({ isActive }) => `information-nav-link${isActive ? ' is-active' : ''}`}><span className="information-nav-number">{item.number}</span>{item.label}<ArrowUpRight size={15} aria-hidden="true" /></NavLink>)}
        </nav>
        <div className="information-sidebar-note"><Ticket size={22} aria-hidden="true" /><h2>Đã đặt vé?</h2><p>Kiểm tra trạng thái và thông tin suất chiếu trong tài khoản của bạn.</p><Link to="/profile/bookings">Vé của tôi <ArrowRight size={15} aria-hidden="true" /></Link></div>
      </aside>}
      <div className="information-content">{children}</div>
    </div>
    <section className="information-contact" aria-labelledby="information-contact-title">
      <div><p className="information-eyebrow">LUÔN CÓ BƯỚC TIẾP THEO</p><h2 id="information-contact-title">Cần thêm hỗ trợ?</h2><p>Chuẩn bị mã đặt vé và email tài khoản để việc kiểm tra thuận tiện hơn.</p></div>
      <a href="mailto:support@premiercinema.vn"><Mail size={18} aria-hidden="true" /><span>Gửi email hỗ trợ<small>support@premiercinema.vn</small></span><ArrowUpRight size={20} aria-hidden="true" /></a>
    </section>
  </div>;
}
