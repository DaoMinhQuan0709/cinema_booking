import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Plus, Search, SearchX, X } from 'lucide-react';
import InformationLayout from './InformationLayout';
import { faqCategories, faqItems } from './informationContent';

const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLocaleLowerCase('vi');

export default function FaqPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Tất cả');
  const words = normalize(search).trim().split(/\s+/).filter(Boolean);
  const visible = faqItems.filter(item => (category === 'Tất cả' || category === item.category) && words.every(word => normalize(`${item.question} ${item.answer} ${item.category}`).includes(word)));

  return <InformationLayout number="05" eyebrow="Một chút giải đáp trước giờ chiếu" title="Câu hỏi thường gặp" description="Từ lần đặt vé đầu tiên đến lúc cầm vé vào rạp. Tìm câu trả lời cho điều bạn đang băn khoăn.">
    <div className="faq-search"><label htmlFor="faq-search">Bạn cần tìm hiểu điều gì?</label><div><Search size={19} aria-hidden="true" /><input id="faq-search" type="search" maxLength={200} value={search} onChange={event => setSearch(event.target.value)} placeholder="Thử “giữ ghế”, “thanh toán”, “bắp nước”…" />{search && <button type="button" aria-label="Xóa từ khóa" onClick={() => setSearch('')}><X size={18} aria-hidden="true" /></button>}</div></div>
    <div className="faq-categories" role="group" aria-label="Lọc theo chủ đề">{faqCategories.map(item => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
    <p className="faq-count" role="status">{visible.length} câu hỏi{search.trim() ? ` phù hợp với “${search.trim()}”` : ` · ${category}`}</p>
    <div className="faq-list">{visible.map(item => <details key={item.id} className="faq-item"><summary><span><small>{item.category}</small>{item.question}</span><Plus size={20} aria-hidden="true" /></summary><div className="faq-answer"><p>{item.answer}</p>{item.to && <Link className="information-text-link" to={item.to}>{item.link}<ArrowRight size={16} aria-hidden="true" /></Link>}</div></details>)}</div>
    {visible.length === 0 && <div className="information-empty"><SearchX size={32} aria-hidden="true" /><h2>Chưa tìm thấy câu hỏi phù hợp</h2><p>Thử từ khóa ngắn hơn hoặc xem tất cả chủ đề.</p><button className="information-button" type="button" onClick={() => { setSearch(''); setCategory('Tất cả'); }}>Xóa bộ lọc</button></div>}
  </InformationLayout>;
}
