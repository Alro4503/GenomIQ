import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Hero from '@/components/home/Hero';
import Features from '@/components/home/Features';
import CallToAction from '@/components/home/CallToAction';

export default function HomePage() {
  // Usamos el componente ProtectedRoute para redirigir usuarios autenticados al dashboard
  return (
    <ProtectedRoute redirectAuthenticated="/dashboard">
      <Hero />
      <Features />
      <CallToAction />
    </ProtectedRoute>
  );
}