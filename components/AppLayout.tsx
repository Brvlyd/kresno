import Sidebar from "./Sidebar";
import Header from "./Header";

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export default function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title={title} subtitle={subtitle} />
        <main className="flex-1 p-8 bg-gray-50 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
