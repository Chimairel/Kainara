'use client';

import WorkspaceTable from '@/components/shared/WorkspaceTable';

import { useSessionQuery } from '@/hooks/useSessionQuery';

import PortalPageHeader from '@/components/shared/PortalPageHeader';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import { getRoleLabel } from '@/lib/role-label';
import { Ban, CheckCircle2, ChevronLeft, ChevronRight, Clock3, RotateCcw, Search, Users, XCircle } from 'lucide-react';
import React, { useState } from 'react';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  image?: string | null;
  emailVerified: boolean;
  onboardingDone: boolean;
  createdAt: string;
  isSuspended: boolean;
  suspensionReason?: string | null;
}

interface UsersSnapshot {
  users: UserRow[];
  total: number;
  totalPages: number;
}
const usersResource = (page: number, search: string) => `admin-users:${page}:${search}`;

export default function AdminUsersPage({ active = true }: { active?: boolean }) {
  const { user: currentUser } = useAuth();
  const ownerId = currentUser?.userId;
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const query = useSessionQuery<UsersSnapshot>({
    ownerId,
    enabled: active,
    resource: usersResource(page, search),
    errorMessage: 'Account records could not be loaded. Please try again.',
    fetcher: async () => {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (search) params.search = search;
      const response = await api.get('/admin/users', { params });
      if (!response.data?.success) throw new Error('Account records could not be loaded. Please try again.');
      return response.data.data;
    },
  });
  const users = query.data?.users ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = query.data?.totalPages ?? 1;
  const { isLoading, error, setError } = query;

  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [isUpdatingAccess, setIsUpdatingAccess] = useState(false);
  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const openAccessDialog = (user: UserRow) => {
    setSelectedUser(user);
    setSuspensionReason('');
    setError(null);
  };

  const closeAccessDialog = () => {
    if (isUpdatingAccess) return;
    setSelectedUser(null);
    setSuspensionReason('');
  };

  const confirmAccessChange = async () => {
    if (!selectedUser || (!selectedUser.isSuspended && !suspensionReason.trim())) return;
    setIsUpdatingAccess(true);
    setError(null);
    try {
      await api.patch(`/admin/users/${selectedUser.id}/suspension`, {
        suspended: !selectedUser.isSuspended,
        reason: selectedUser.isSuspended ? undefined : suspensionReason.trim(),
      });
      closeAccessDialog();
      await query.refetch();
    } catch (requestError) {
      console.error('Failed to update account access:', requestError);
      setError('Account access could not be updated. Please try again.');
    } finally {
      setIsUpdatingAccess(false);
      setSelectedUser(null);
    }
  };

  return (
    <div className="space-y-7">
      <PortalPageHeader
        headingLevel="h2"
        icon={Users}
        eyebrow="Identity directory"
        title="Account management"
        description="Inspect account roles, verification state, onboarding progress, and access across the platform."
        meta={
          <span className="rounded-full border border-brand-border/70 bg-brand-surface/60 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-brand-muted dark:border-[#173e33] dark:bg-[#0e271f]">
            {query.data ? `${total} accounts` : 'Account count unavailable'}
          </span>
        }
      />

      <form onSubmit={handleSearch} className="portal-filter-panel flex gap-2 p-3">
        <div className="relative min-w-0 flex-1">
          <label htmlFor="admin-user-search" className="sr-only">
            Search accounts by name or email
          </label>
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
          <input
            id="admin-user-search"
            name="search"
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by name or email..."
            className="h-11 w-full rounded-2xl border border-brand-border/70 bg-brand-surface/70 pl-10 pr-4 text-sm text-brand-text outline-none transition focus:border-brand-green/50 focus:ring-4 focus:ring-brand-green/10"
          />
        </div>
        <button
          type="submit"
          className="rounded-2xl bg-brand-accent px-5 text-sm font-extrabold text-[#07100d] shadow-neon transition hover:-translate-y-0.5"
        >
          Search
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-status-error-text/25 bg-status-error-bg/10 p-4 text-sm font-semibold text-status-error-text"
        >
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="py-16 text-center">
          <span className="animate-pulse text-brand-muted">Loading accounts...</span>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <WorkspaceTable
              label="Accounts"
              rows={users}
              rowKey={(user) => String(user.id)}
              columns={[
                { key: 'col-0', header: <>Name</>, headerClassName: 'min-w-[100px]' },
                { key: 'col-1', header: <>Email</>, headerClassName: 'min-w-[100px]' },
                { key: 'col-2', header: <>Role</>, headerClassName: 'min-w-[100px]' },
                { key: 'col-3', header: <>Verified</>, headerClassName: 'min-w-[100px]' },
                { key: 'col-4', header: <>Onboarded</>, headerClassName: 'min-w-[100px]' },
                { key: 'col-5', header: <>Joined</>, headerClassName: 'min-w-[100px]' },
                { key: 'col-6', header: <>Access</>, headerClassName: 'min-w-[100px]' },
              ]}
              cells={(user) => {
                return [
                  <>
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar name={user.name} seed={user.image} size="sm" />
                      <span className="min-w-0 break-words [overflow-wrap:anywhere]">{user.name}</span>
                    </div>
                  </>,
                  <>{user.email}</>,
                  <>
                    <Badge
                      showIcon={false}
                      className="max-w-full px-2 text-[9px] tracking-normal [overflow-wrap:anywhere]"
                      variant={user.role === 'ADMIN' ? 'rejected' : user.role === 'NUTRITIONIST' ? 'verified' : 'user'}
                    >
                      {getRoleLabel(user.role)}
                    </Badge>
                  </>,
                  <>
                    {user.emailVerified ? (
                      <CheckCircle2 aria-label="Email verified" className="mx-auto h-4 w-4 text-brand-green" />
                    ) : (
                      <XCircle aria-label="Email not verified" className="mx-auto h-4 w-4 text-red-400" />
                    )}
                  </>,
                  <>
                    {user.onboardingDone ? (
                      <CheckCircle2 aria-label="Onboarding complete" className="mx-auto h-4 w-4 text-brand-green" />
                    ) : (
                      <Clock3 aria-label="Onboarding incomplete" className="mx-auto h-4 w-4 text-amber-500" />
                    )}
                  </>,
                  <>{new Date(user.createdAt).toLocaleDateString()}</>,
                  <>
                    <button
                      type="button"
                      aria-label={user.isSuspended ? 'Reinstate account' : 'Suspend account'}
                      onClick={() => openAccessDialog(user)}
                      disabled={user.id === currentUser?.userId}
                      className={`inline-flex min-h-11 max-w-full items-center justify-center gap-1 rounded-xl px-2 py-2 text-[10px] font-bold transition ${user.isSuspended ? 'bg-brand-green/10 text-brand-green hover:bg-brand-green/15' : 'bg-red-500/10 text-red-400 hover:bg-red-500/15'}`}
                      title={
                        user.id === currentUser?.userId
                          ? 'You cannot suspend your own administrator account.'
                          : user.suspensionReason || undefined
                      }
                    >
                      {user.isSuspended ? <RotateCcw className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                      {user.isSuspended ? 'Reinstate' : 'Suspend'}
                    </button>
                  </>,
                ];
              }}
            />
          </div>
          <div className="flex items-center justify-between border-t border-brand-border/50 px-5 py-4">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="flex items-center gap-2 text-xs font-semibold text-brand-muted transition hover:text-brand-green disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <span className="font-mono text-[9px] uppercase tracking-wider text-brand-muted">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-2 text-xs font-semibold text-brand-muted transition hover:text-brand-green disabled:opacity-30"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <Modal
        isOpen={selectedUser !== null}
        onClose={closeAccessDialog}
        title={selectedUser?.isSuspended ? 'Reinstate account' : 'Suspend account'}
        description={selectedUser ? `${selectedUser.name} · ${selectedUser.email}` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={closeAccessDialog} disabled={isUpdatingAccess}>
              Cancel
            </Button>
            <Button
              variant={selectedUser?.isSuspended ? 'primary' : 'danger'}
              type="button"
              onClick={confirmAccessChange}
              disabled={!selectedUser?.isSuspended && !suspensionReason.trim()}
              isLoading={isUpdatingAccess}
            >
              {selectedUser?.isSuspended ? 'Reinstate account' : 'Suspend account'}
            </Button>
          </>
        }
      >
        {selectedUser?.isSuspended ? (
          <p className="text-sm text-brand-muted">This restores the account&apos;s access immediately.</p>
        ) : (
          <div>
            <label htmlFor="suspension-reason" className="mb-2 block text-xs font-bold text-brand-text">
              Reason for suspension
            </label>
            <textarea
              id="suspension-reason"
              value={suspensionReason}
              onChange={(event) => setSuspensionReason(event.target.value)}
              maxLength={240}
              rows={4}
              placeholder="Explain why access is being suspended…"
              className="w-full resize-none rounded-2xl border border-brand-border bg-brand-bgAlt px-4 py-3 text-sm text-brand-text outline-none focus:border-red-500/60 focus:ring-4 focus:ring-red-500/10"
            />
            <p className="mt-2 text-[10px] text-brand-muted">
              This reason is recorded in the administrative audit log.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
