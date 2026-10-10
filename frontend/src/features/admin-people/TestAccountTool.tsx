'use client';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import NativeSelect from '@/components/ui/NativeSelect';
import Modal from '@/components/ui/Modal';
import WorkspaceTable from '@/components/shared/WorkspaceTable';
import { getRoleLabel } from '@/lib/role-label';
import { useTestAccountTool } from './useTestAccountTool';
import { useId } from 'react';
import TestMemberProfileFields from './TestMemberProfileFields';

const label = (value: string) => (value === 'NONE' ? 'None' : value.toLowerCase().replaceAll('_', ' '));
function Declarations({
  title,
  values,
  selected,
  onChange,
  disabled,
}: {
  title: string;
  values: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="space-y-2 rounded-2xl border border-brand-border p-4">
      <legend className="px-1 text-xs font-bold">{title}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {values.map((value) => (
          <label key={value} className="flex min-h-9 items-center gap-2 capitalize">
            <input
              type="checkbox"
              checked={selected.includes(value)}
              onChange={(event) => {
                const next =
                  value === 'NONE'
                    ? ['NONE']
                    : event.target.checked
                      ? [...selected.filter((entry) => entry !== 'NONE'), value]
                      : selected.filter((entry) => entry !== value);
                onChange(next.length ? next : ['NONE']);
              }}
            />
            {label(value)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function TestAccountTool({ active, onCreated }: { active: boolean; onCreated: () => void }) {
  const tool = useTestAccountTool(active, onCreated);
  const roleId = useId();
  const statusId = useId();
  if (!tool.capabilities?.available) return null;
  const { options, preview, result, busy } = tool;
  return (
    <>
      <Button variant="secondary" onClick={tool.start}>
        Create test accounts
      </Button>
      <Modal
        isOpen={tool.open}
        onClose={tool.close}
        size="xl"
        title="Create test accounts"
        description="Development only. Marked accounts use normal login and skip email verification, onboarding, and RND application."
        footer={
          result ? (
            <Button onClick={tool.close}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" disabled={busy} onClick={tool.close}>
                Cancel
              </Button>
              {preview ? (
                <Button disabled={!tool.confirmed || busy} isLoading={busy} onClick={tool.create}>
                  Create accounts
                </Button>
              ) : (
                <Button isLoading={busy} onClick={tool.inspect}>
                  Preview accounts
                </Button>
              )}
            </>
          )
        }
      >
        <div className="space-y-4">
          {tool.error && (
            <p role="alert" className="text-status-error-text">
              {tool.error}
            </p>
          )}
          {!result && (
            <>
              <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Group name"
                  value={options.set}
                  maxLength={24}
                  placeholder="e.g. defense-october"
                  helperText="Use a new group for fresh accounts. Repeating it keeps existing accounts."
                  onChange={(event) => tool.update({ set: event.target.value })}
                />
                <Input
                  label="Display name"
                  value={options.name}
                  maxLength={70}
                  onChange={(event) => tool.update({ name: event.target.value })}
                />
                <div className="space-y-2">
                  <label htmlFor={roleId} className="block text-xs font-bold">
                    Role
                  </label>
                  <NativeSelect
                    id={roleId}
                    value={options.role}
                    onChange={(event) =>
                      tool.update({
                        role: event.target.value as typeof options.role,
                        conditions: ['NONE'],
                        allergens: ['NONE'],
                      })
                    }
                  >
                    <option value="USER">Member</option>
                    <option value="RND">RND</option>
                    <option value="ADMIN">Admin</option>
                  </NativeSelect>
                </div>
                <Input
                  label="Number of accounts"
                  type="number"
                  min={1}
                  max={10}
                  value={options.count}
                  onChange={(event) => tool.update({ count: Number(event.target.value) })}
                />
              </fieldset>
              {options.role === 'USER' && (
                <>
                  <TestMemberProfileFields
                    profile={options.profile}
                    disabled={busy}
                    pregnant={options.conditions.includes('PREGNANT')}
                    onChange={(patch) => tool.update({ profile: { ...options.profile, ...patch } })}
                  />
                  <Declarations
                    title="Conditions"
                    values={tool.capabilities.conditions ?? []}
                    selected={options.conditions}
                    disabled={busy}
                    onChange={(conditions) => tool.update({ conditions })}
                  />
                  <Declarations
                    title="Allergies"
                    values={tool.capabilities.allergens ?? []}
                    selected={options.allergens}
                    disabled={busy}
                    onChange={(allergens) => tool.update({ allergens })}
                  />
                  <p className="text-xs text-brand-muted">
                    Members start with a test profile and acknowledged guidance. Health details and meal approvals still
                    use the normal review requirements. No meals are created.
                  </p>
                </>
              )}
              {options.role === 'RND' && (
                <div className="space-y-2">
                  <label htmlFor={statusId} className="block text-xs font-bold">
                    RND status
                  </label>
                  <NativeSelect
                    id={statusId}
                    disabled={busy}
                    value={options.rndStatus}
                    onChange={(event) => tool.update({ rndStatus: event.target.value })}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="EXPIRED">Expired license</option>
                    <option value="UNVERIFIED">Unverified</option>
                    <option value="SUSPENDED">Suspended</option>
                  </NativeSelect>
                  <p className="text-xs text-brand-muted">
                    Active test RNDs join the shared queue. Other statuses retain their normal access restrictions.
                  </p>
                </div>
              )}
            </>
          )}
          {(preview || result) && (
            <WorkspaceTable
              label="Test account preview"
              rows={(preview ?? result)!.accounts}
              rowKey={(row) => row.id}
              columns={[
                { key: 'email', header: 'Email' },
                { key: 'role', header: 'Role' },
                { key: 'status', header: 'Account' },
              ]}
              cells={(row) => [
                row.email,
                getRoleLabel(row.role),
                row.exists ? 'Existing — unchanged' : result ? 'Created' : 'New',
              ]}
            />
          )}
          {preview && (
            <div className="rounded-2xl border border-brand-border p-4">
              <p className="break-all text-xs">Database: {preview.target}</p>
              <label className="mt-3 flex items-start gap-2">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={tool.confirmed}
                  onChange={(event) => tool.setConfirmed(event.target.checked)}
                />
                I confirm this is the development database where I want these accounts created.
              </label>
            </div>
          )}
          {result && (
            <div className="space-y-3" role="status">
              <p>Finished. Existing accounts and passwords were preserved.</p>
              {result.newAccountPassword ? (
                <>
                  <Input label="Password for newly created accounts" readOnly value={result.newAccountPassword} />
                  <p className="text-xs text-brand-muted">
                    Save these credentials before closing. This password applies only to accounts marked Created. Sign
                    in through the normal login page.
                  </p>
                  <Button variant="secondary" onClick={tool.copy}>
                    Copy login credentials
                  </Button>
                </>
              ) : (
                <p>All accounts already existed. Use their original credentials, or create a new group.</p>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
