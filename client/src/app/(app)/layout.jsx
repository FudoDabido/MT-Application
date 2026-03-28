'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../../components/shared/Spinner';
import AppShell from '../../components/layout/AppShell';

export default function AppLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950">
        <Spinner />
      </div>
    );
  }

  if (!user) return null;

  return <AppShell>{children}</AppShell>;
}
