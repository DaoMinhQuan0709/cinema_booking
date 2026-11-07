import { Outlet } from 'react-router-dom';
import Header from '../components/common/Header';
import Footer from '../components/common/Footer';
import AuthModal from '../features/auth/AuthModal';

/**
 * MainLayout bọc khung giao diện dùng chung cho toàn bộ phân hệ khách hàng.
 * Bao gồm: Header cố định phía trên, nội dung động thay đổi theo route (Outlet),
 * Footer ở dưới cùng và AuthModal toàn cục.
 */
export const MainLayout = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background text-white selection:bg-primary selection:text-white">
      {/* Header thanh dieu huong */}
      <Header />

      {/* Noi dung chinh cua tung trang */}
      <main className="flex-1 w-full flex flex-col">
        <Outlet />
      </main>

      {/* Footer chan trang */}
      <Footer />

      {/* Modal Dang nhap / Dang ky toan cuc */}
      <AuthModal />
    </div>
  );
};

export default MainLayout;

