export const getRoleHome = (role: 'USER' | 'NUTRITIONIST' | 'ADMIN') => {
  if (role === 'ADMIN') return '/admin/overview';
  if (role === 'NUTRITIONIST') return '/nutritionist/reviews';
  return '/dashboard';
};
