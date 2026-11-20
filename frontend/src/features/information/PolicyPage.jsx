import { Link } from 'react-router-dom';
import { ArrowRight, Info } from 'lucide-react';
import InformationLayout from './InformationLayout';
import { documents } from './informationContent';

export default function PolicyPage({ documentKey }) {
  const document = documents[documentKey];
  return <InformationLayout {...document}>
    <div className="information-takeaway"><Info size={20} aria-hidden="true" /><p>{document.takeaway}</p></div>
    <nav className="information-toc" aria-label="Nội dung trang"><p className="information-nav-label">Trên trang này</p><div>{document.sections.map((section, index) => <a key={section.id} href={`#${section.id}`}><span>{String(index + 1).padStart(2, '0')}</span>{section.title}</a>)}</div></nav>
    <div className="information-articles">{document.sections.map((section, index) => <section key={section.id} id={section.id} className="information-article" aria-labelledby={`${section.id}-title`}>
      <span className="information-section-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      <div><h2 id={`${section.id}-title`}>{section.title}</h2>{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}{section.link && <Link className="information-text-link" to={section.link.to}>{section.link.label}<ArrowRight size={16} aria-hidden="true" /></Link>}</div>
    </section>)}</div>
  </InformationLayout>;
}
