import { Navigate, Route, Routes } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { TeamSession } from '@oa/types';
import { Spinner } from '@oa/ui';
import { api } from './api';
import { SignIn } from './pages/SignIn';
import { Events } from './pages/Events';
import { Dashboard } from './pages/Dashboard';
import { Setup } from './pages/Setup';
import { Messages } from './pages/Messages';

export function App() {
  const session = useQuery({
    queryKey: ['session'],
    queryFn: () => api.get<TeamSession>('/auth/me'),
    retry: false,
  });

  if (session.isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Spinner label="One moment" />
      </div>
    );
  }

  if (session.isError || !session.data) {
    return (
      <Routes>
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="*" element={<Navigate to="/sign-in" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/sign-in" element={<Navigate to="/" replace />} />
      <Route path="/" element={<Events session={session.data} />} />
      <Route path="/events/:eventId" element={<Dashboard session={session.data} />} />
      <Route path="/events/:eventId/setup" element={<Setup session={session.data} />} />
      <Route path="/events/:eventId/messages" element={<Messages session={session.data} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
