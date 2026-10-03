/** Human-readable account roles; stored role values remain API identifiers. */
export function getRoleLabel(role: string): string {
  switch (role) {
    case 'USER':
      return 'Member';
    case 'NUTRITIONIST':
      return 'Nutritionist';
    case 'ADMIN':
      return 'Admin';
    default:
      return role;
  }
}
