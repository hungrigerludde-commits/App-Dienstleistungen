import ClientSearch from '@/components/home/ClientSearch';
import ParentHome from '@/components/home/ParentHome';
import StudentHome from '@/components/home/StudentHome';
import { useProfile } from '@/lib/auth';

export default function Home() {
  const profile = useProfile();
  if (profile.role === 'student') return <StudentHome />;
  if (profile.role === 'parent') return <ParentHome />;
  return <ClientSearch />;
}
