import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<div className="p-8 text-2xl font-bold">Trang chủ PremierCinema</div>} />
          {/* Các route tiếp theo sẽ được nhúng vào đây */}
        </Routes>
      </BrowserRouter>
      {/* Toast thông báo toàn cục */}
      <Toaster position="top-right" theme="dark" richColors />
    </QueryClientProvider>
  );
}

export default App;