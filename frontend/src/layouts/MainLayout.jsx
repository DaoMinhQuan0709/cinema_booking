import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../components/common/Header';
import Footer from '../components/common/Footer';
import AuthModal from '../features/auth/AuthModal';
import ChatWidget from '../features/chatbot/ChatWidget';

/**
 * MainLayout bọc khung giao diện dùng chung cho toàn bộ phân hệ khách hàng.
 * Bao gồm: Header cố định phía trên, nội dung động thay đổi theo route (Outlet),
 * Footer ở dưới cùng, AuthModal toàn cục và widget trợ lý CineBot nổi.
 */
export const MainLayout = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background text-white selection:bg-primary selection:text-white">
      {/* Header thanh dieu huong */}
      <Header />

      {/* Noi dung chinh cua tung trang */}
      <main className="flex-1 w-full flex flex-col">
        <Suspense fallback={<p role="status" className="px-6 py-16 text-center text-sm text-muted">Đang tải trang…</p>}>
          <Outlet />
        </Suspense>
      </main>

      {/* Footer chan trang */}
      <Footer />

      {/* Modal Dang nhap / Dang ky toan cuc */}
      <AuthModal />

      {/* Tro ly ao CineBot (nut noi goc duoi ben phai) */}
      <ChatWidget />
    </div>
  );
};

export default MainLayout;
