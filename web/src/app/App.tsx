import { Route, Routes } from 'react-router-dom';
import { CommandPalette } from '@/features/command/command-palette';
import { useThemeSync } from '@/features/themes/use-theme-sync';
import { Header } from './header';
import { HomePage } from './pages/home-page';
import { NotFoundPage } from './pages/not-found-page';
import { ProjectDetailPage } from './pages/project-detail-page';

export function App() {
  useThemeSync();

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:text-accent-fg"
      >
        跳到主要内容
      </a>
      <Header />
      <main id="main" className="mx-auto w-full max-w-7xl px-4 pb-20 pt-5 sm:px-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/p/:id" element={<ProjectDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <CommandPalette />
    </div>
  );
}
