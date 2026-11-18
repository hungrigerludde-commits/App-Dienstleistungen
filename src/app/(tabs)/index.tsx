import ClientStart from '@/components/start/ClientStart';
import ParentStart from '@/components/start/ParentStart';
import StudentStart from '@/components/start/StudentStart';
import { useProfile } from '@/lib/auth';

export default function Start() {
  const me = useProfile();
  if (me.role === 'student') return <StudentStart />;
  if (me.role === 'parent') return <ParentStart />;
  return <ClientStart />;
}
