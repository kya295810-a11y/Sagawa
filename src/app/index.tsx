import { Redirect, type Href } from "expo-router";
import { useAuthStore } from '@/store/auth-store';

export default function IndexRoute() {
  const status = useAuthStore((state) => state.status);
  const profileCompleted = useAuthStore((state) => state.session?.profileCompleted ?? false);
  if (status !== 'authenticated') return <Redirect href="/login" />;
  return <Redirect href={(profileCompleted ? '/(tabs)' : '/complete-profile') as Href} />;
}
