import { Navigate, Route, Routes } from 'react-router-dom';
import { Register } from './pages/Register';
import { Pass } from './pages/Pass';
import { Scan } from './pages/Scan';
import { WalkIn } from './pages/WalkIn';
import { Unsubscribe } from './pages/Unsubscribe';
import { NotFound } from './pages/NotFound';
import { EVENT_SLUG } from './api';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/register/${EVENT_SLUG}`} replace />} />
      <Route path="/register/:slug" element={<Register />} />
      <Route path="/pass/:code" element={<Pass />} />
      {/* The delegate's rotating code and the gate poster open these two. */}
      <Route path="/b/:token" element={<Scan kind="BOARDING" />} />
      <Route path="/g/:token" element={<Scan kind="GATE" />} />
      <Route path="/walk-in/:token" element={<WalkIn />} />
      <Route path="/unsubscribe/:id/:token" element={<Unsubscribe />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
