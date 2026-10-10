import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TestAccountTool from './TestAccountTool';
const fixtures = vi.hoisted(() => ({ available: true, post: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'admin' } }) }));
vi.mock('@/hooks/useSessionQuery', () => ({
  useSessionQuery: () => ({
    data: { available: fixtures.available, conditions: ['NONE', 'DIABETES', 'PREGNANT'], allergens: ['NONE', 'NUTS'] },
  }),
}));
vi.mock('@/lib/axios', () => ({ default: { post: fixtures.post } }));
const accounts = [{ id: 'new', email: 'qa-defense-user-1@example.test', name: 'Test', role: 'USER', exists: false }];
const preview = { data: { data: { accounts, target: 'localhost:5432/dev', previewToken: 'signed-preview' } } };
async function openAndPreview() {
  fireEvent.click(screen.getByRole('button', { name: 'Create test accounts' }));
  fireEvent.change(screen.getByLabelText('Group name'), { target: { value: 'defense' } });
  fireEvent.click(screen.getByRole('button', { name: 'Preview accounts' }));
  await screen.findByText('Database: localhost:5432/dev');
}
describe('admin test account creation', () => {
  beforeEach(() => {
    fixtures.available = true;
    fixtures.post.mockReset();
    fixtures.post.mockResolvedValue(preview);
  });
  it('hides the tool when the backend does not enable it', () => {
    fixtures.available = false;
    render(<TestAccountTool active onCreated={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Create test accounts' })).not.toBeInTheDocument();
  });
  it('requires target confirmation and invalidates preview after editing', async () => {
    render(<TestAccountTool active onCreated={vi.fn()} />);
    await openAndPreview();
    expect(screen.getByText(/New test accounts across groups and roles share the same password/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create accounts' })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/I confirm this is the development database/));
    expect(screen.getByRole('button', { name: 'Create accounts' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'RND' } });
    expect(screen.queryByRole('button', { name: 'Create accounts' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('RND status')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Conditions' })).not.toBeInTheDocument();
    expect(fixtures.post).toHaveBeenCalledTimes(1);
  });
  it('sends configurable member factors and invalidates the preview when a factor changes', async () => {
    render(<TestAccountTool active onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create test accounts' }));
    fireEvent.change(screen.getByLabelText('Group name'), { target: { value: 'factors' } });
    fireEvent.change(screen.getByLabelText('Current weight (kg)'), { target: { value: '72' } });
    expect(screen.getByLabelText('Target weight (kg)')).toHaveValue(72);
    expect(screen.getByLabelText('Target weight (kg)')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Goal'), { target: { value: 'LOSE_WEIGHT' } });
    fireEvent.change(screen.getByLabelText('Target weight (kg)'), { target: { value: '65' } });
    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '45' } });
    fireEvent.change(screen.getByLabelText('Biological sex'), { target: { value: 'FEMALE' } });
    fireEvent.change(screen.getByLabelText('Activity level'), { target: { value: 'ACTIVE' } });
    fireEvent.change(screen.getByLabelText('Dietary preference'), { target: { value: 'PESCATARIAN' } });
    fireEvent.change(screen.getByLabelText('Rice preference'), { target: { value: 'NO_RICE' } });
    fireEvent.change(screen.getByLabelText('Shopping day'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview accounts' }));
    await screen.findByText('Database: localhost:5432/dev');
    expect(fixtures.post.mock.calls[0][1].profile).toMatchObject({
      weightKg: 72,
      targetWeightKg: 65,
      age: 45,
      biologicalSex: 'FEMALE',
      activityLevel: 'ACTIVE',
      goal: 'LOSE_WEIGHT',
      dietaryPreference: 'PESCATARIAN',
      ricePreference: 'NO_RICE',
      shoppingDayOfWeek: 2,
    });
    fireEvent.click(screen.getByLabelText(/I confirm this is the development database/));
    fireEvent.change(screen.getByLabelText('Height (cm)'), { target: { value: '165' } });
    expect(screen.queryByRole('button', { name: 'Create accounts' })).not.toBeInTheDocument();
  });
  it('keeps pregnancy settings coherent and excludes member factors from RND requests', async () => {
    render(<TestAccountTool active onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create test accounts' }));
    fireEvent.change(screen.getByLabelText('Group name'), { target: { value: 'roles' } });
    fireEvent.click(screen.getByLabelText('pregnant'));
    expect(screen.getByLabelText('Biological sex')).toHaveValue('FEMALE');
    expect(screen.getByLabelText('Biological sex')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'RND' } });
    expect(screen.queryByRole('group', { name: 'Member profile' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Preview accounts' }));
    await screen.findByText('Database: localhost:5432/dev');
    expect(fixtures.post.mock.calls[0][1]).not.toHaveProperty('profile');
  });
  it('shows credentials only after successful creation and refreshes accounts', async () => {
    const refresh = vi.fn();
    render(<TestAccountTool active onCreated={refresh} />);
    await openAndPreview();
    fixtures.post.mockResolvedValueOnce({
      data: { data: { accounts, newAccountPassword: 'synthetic-returned-password' } },
    });
    fireEvent.click(screen.getByLabelText(/I confirm this is the development database/));
    fireEvent.click(screen.getByRole('button', { name: 'Create accounts' }));
    expect(await screen.findByLabelText('Password for newly created accounts')).toHaveValue(
      'synthetic-returned-password'
    );
    expect(refresh).toHaveBeenCalledOnce();
    expect(fixtures.post.mock.calls[1][1]).toMatchObject({ previewToken: 'signed-preview', confirmedTarget: true });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByLabelText('Password for newly created accounts')).not.toBeInTheDocument();
  });
  it('handles kept accounts and failed creation without showing a new password', async () => {
    render(<TestAccountTool active onCreated={vi.fn()} />);
    await openAndPreview();
    fixtures.post.mockRejectedValueOnce({ response: { data: { error: 'Preview expired' } } });
    fireEvent.click(screen.getByLabelText(/I confirm this is the development database/));
    fireEvent.click(screen.getByRole('button', { name: 'Create accounts' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Preview expired'));
    expect(screen.queryByLabelText('Password for newly created accounts')).not.toBeInTheDocument();
    fixtures.post.mockResolvedValueOnce(preview);
    fireEvent.click(screen.getByRole('button', { name: 'Preview accounts' }));
    await screen.findByText('Database: localhost:5432/dev');
    fixtures.post.mockResolvedValueOnce({
      data: { data: { accounts: accounts.map((row) => ({ ...row, exists: true })), newAccountPassword: null } },
    });
    fireEvent.click(screen.getByLabelText(/I confirm this is the development database/));
    fireEvent.click(screen.getByRole('button', { name: 'Create accounts' }));
    expect(await screen.findByText(/All accounts already existed/)).toBeInTheDocument();
  });
});
