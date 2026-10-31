/**
 * Who may do what in a creator workspace. The creator owns it; a manager is
 * someone the creator authorized (an agent, manager or assistant). Services
 * check these before every write; the UI only hides what a role cannot do.
 */
export const ROLES = ['owner', 'manager'] as const;
export type Role = (typeof ROLES)[number];

export const CAPABILITIES = [
  'view',
  'edit_profile',
  'manage_channels',
  'publish_profile',
  'manage_team',
  'delete_data',
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const MATRIX: Readonly<Record<Role, readonly Capability[]>> = {
  owner: CAPABILITIES,
  // A manager runs the day-to-day work but cannot change who has access or erase the creator's data.
  manager: ['view', 'edit_profile', 'manage_channels', 'publish_profile'],
};

export function can(role: Role, capability: Capability): boolean {
  return MATRIX[role].includes(capability);
}
