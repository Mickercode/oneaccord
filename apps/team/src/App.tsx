import { Navigate, Route, Routes } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { TeamSession } from '@oa/types';
import { Spinner } from '@oa/ui';
import { api } from './api';
import { SignIn } from './pages/SignIn';
import { Trips } from './pages/Trips';
import { Boarding } from './pages/Boarding';
import { Gate } from './pages/Gate';
import { Hall } from './pages/Hall';
import { LookUp } from './pages/LookUp';

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: () => api.get<TeamSession>('/auth/me'),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function App() {
  const session = useSession();

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

  const isUsher = session.data.role === 'USHER';

  return (
    <Routes>
      <Route path="/sign-in" element={<Navigate to="/" replace />} />
      <Route path="/" element={<Navigate to={isUsher ? '/gate' : '/trips'} replace />} />
      <Route path="/trips" element={<Trips session={session.data} />} />
      <Route path="/trips/:tripId" element={<Boarding session={session.data} />} />
      <Route path="/gate" element={<Gate session={session.data} />} />
      <Route path="/hall" element={<Hall session={session.data} />} />
      <Route path="/look-up" element={<LookUp session={session.data} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
