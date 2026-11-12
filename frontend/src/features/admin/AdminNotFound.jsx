import { Link } from 'react-router-dom';

export default function AdminNotFound() {
  return (
    <section aria-labelledby="admin-page-title">
      <h1 id="admin-page-title" className="text-2xl font-bold text-white sm:text-3xl">Trang quản trị không tồn tại</h1>
      <p className="mt-2 text-sm text-muted">Đường dẫn bạn mở không thuộc Admin Portal.</p>
      <Link to="/admin/reports" className="mt-5 inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primaryHover">
        Về trang báo cáo
      </Link>
    </section>
  );
}
