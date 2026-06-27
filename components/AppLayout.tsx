import Sidebar from "./Sidebar";
import AuthGuard from "./AuthGuard";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        {/* Main content — pushed right by the sidebar spacer inside Sidebar */}
        <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          {children}
        </div>
      </div>
    </AuthGuard>
  );
}
