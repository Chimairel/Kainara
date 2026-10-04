import { redirect } from 'next/navigation';

export default function LegacyPage() {
  redirect('/admin/meals?tab=library');
}
