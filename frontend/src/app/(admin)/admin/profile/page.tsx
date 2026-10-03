'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import PasswordInput from '@/components/ui/PasswordInput';
import AvatarSettings from '@/features/profile/AvatarSettings';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  ShieldCheck,
  ShieldAlert,
  LogOut,
  KeyRound,
  Palette,
  Mail,
  CheckCircle2,
  AlertTriangle,
  Server,
  Lock,
  Sparkles,
} from 'lucide-react';

export default function AdminProfilePage() {
  const { user, logout, updateUserSession } = useAuth();
  const [activeTab, setActiveTab] = useState<'security' | 'avatar'>('security');

  // Name state
  const [name, setName] = useState(user?.name || '');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Name cannot be empty.');
      return;
    }
    setIsSavingName(true);
    setNameError(null);
    setNameSuccess(null);
    try {
      const res = await api.put('/user/profile/settings', { name: name.trim() });
      if (res.data?.success) {
        setNameSuccess('Display name updated successfully.');
        updateUserSession({ name: name.trim() });
      }
    } catch (err: unknown) {
      setNameError(getApiErrorMessage(err, 'Failed to update name.'));
    } finally {
      setIsSavingName(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    setIsUpdatingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(null);
    try {
      const res = await api.put('/user/profile/settings', {
        currentPassword,
        newPassword,
      });
      if (res.data?.success) {
        setPasswordSuccess('Password changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: unknown) {
      setPasswordError(getApiErrorMessage(err, 'Failed to update password.'));
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (!user) {
    return <div className="text-brand-muted text-center mt-20">Please log in to view administrator settings.</div>;
  }

  return (
    <div className="portal-page space-y-6">
      <PortalPageHeader
        icon={ShieldCheck}
        eyebrow="Control center"
        title="Administrator profile"
        description="Manage your platform administrative credentials, security, avatar, and active session."
      />

      {/* 1. Official Platform Administrator Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-brand-border/80 bg-brand-surface shadow-card transition-all">
        {/* Regulatory Ribbon */}
        <div className="flex flex-wrap items-center justify-between border-b border-brand-border/60 bg-brand-bgAlt/80 px-6 py-2.5 text-[11px] font-mono font-semibold tracking-wider text-brand-muted">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-brand-green" />
            <span className="uppercase text-brand-green font-bold">
              KAINARA CONTROL CENTER · ROOT SYSTEM GOVERNANCE
            </span>
          </div>
          <span className="rounded-full bg-brand-green/10 border border-brand-green/30 px-2.5 py-0.5 text-[10px] font-bold text-brand-green flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-green animate-pulse" />
            ACTIVE ADMIN SESSION
          </span>
        </div>

        {/* Hero Content */}
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="relative shrink-0">
              <div className="relative h-24 w-24 rounded-full overflow-hidden border-2 border-brand-green ring-4 ring-brand-green/20 shadow-xl flex items-center justify-center bg-brand-surface">
                <Avatar name={user.name} seed={user.image} size="xl" />
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-brand-green text-white shadow-lg ring-2 ring-brand-surface">
                <ShieldCheck className="h-4 w-4 stroke-[3]" />
              </span>
            </div>

            <div className="min-w-0 flex-1 text-center sm:text-left space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-brand-text">
                  {user.name}
                </h1>
                <Badge variant="verified">Platform Administrator</Badge>
                <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-purple-400">
                  <ShieldAlert className="h-3 w-3" /> Root Access
                </span>
              </div>

              <p className="font-mono text-xs font-semibold text-brand-muted flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <Mail className="h-3.5 w-3.5 text-brand-green" />
                <span>{user.email}</span>
                <span>·</span>
                <span className="text-brand-green font-bold">Role: {user.role}</span>
              </p>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1 text-xs text-brand-muted">
                <span className="inline-flex items-center gap-1">
                  <Server className="h-3.5 w-3.5 text-brand-cyan" />
                  Full System Governance
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5 text-brand-accent" />
                  PRC RND Verification Authority
                </span>
              </div>
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === 'avatar' ? 'security' : 'avatar')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-border/80 bg-brand-bgAlt/60 px-4 py-2 text-xs font-bold text-brand-text hover:bg-brand-bgAlt hover:border-brand-green/30 transition-all shadow-xs"
              >
                <Sparkles className="h-3.5 w-3.5 text-brand-accent" />
                <span>{activeTab === 'avatar' ? 'Account & Security' : 'Customize Avatar'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 4-Tile Stat Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-brand-border/70 bg-brand-surface p-4 shadow-sm">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-muted">
            Authority Level
          </span>
          <p className="mt-2 font-display text-sm font-black text-brand-text">Root System Administrator</p>
          <p className="text-[11px] text-brand-green font-semibold mt-0.5">Unrestricted System Scope</p>
        </div>

        <div className="rounded-2xl border border-brand-border/70 bg-brand-surface p-4 shadow-sm">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-muted">
            Session Status
          </span>
          <p className="mt-2 font-display text-sm font-black text-brand-green">Authenticated &amp; Active</p>
          <p className="text-[11px] text-brand-muted mt-0.5">Security Token Valid</p>
        </div>

        <div className="rounded-2xl border border-brand-border/70 bg-brand-surface p-4 shadow-sm">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-muted">
            Access Scope
          </span>
          <p className="mt-2 font-display text-sm font-black text-brand-text">Global Platform Management</p>
          <p className="text-[11px] text-brand-muted mt-0.5">Members, RNDs, Database &amp; AI</p>
        </div>

        <div className="rounded-2xl border border-brand-border/70 bg-brand-surface p-4 shadow-sm">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-muted">
            Compliance Policy
          </span>
          <p className="mt-2 font-display text-sm font-black text-brand-text">Strict Audit Logging</p>
          <p className="text-[11px] text-brand-green font-semibold mt-0.5">Compliant</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-brand-border/60 gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 border-b-2 pb-3 text-xs font-bold transition-all ${
            activeTab === 'security'
              ? 'border-brand-green text-brand-green'
              : 'border-transparent text-brand-muted hover:text-brand-text'
          }`}
        >
          <KeyRound className="h-4 w-4" />
          <span>Account &amp; Security</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('avatar')}
          className={`flex items-center gap-2 border-b-2 pb-3 text-xs font-bold transition-all ${
            activeTab === 'avatar'
              ? 'border-brand-green text-brand-green'
              : 'border-transparent text-brand-muted hover:text-brand-text'
          }`}
        >
          <Palette className="h-4 w-4" />
          <span>Avatar &amp; Appearance</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'security' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Account Details & Password (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Update Name Card */}
            <Card className="p-6 space-y-5">
              <div>
                <p className="portal-section-label">Account Details</p>
                <h3 className="font-display text-base font-bold text-brand-text mt-1">Administrator Identity</h3>
                <p className="text-xs text-brand-muted mt-0.5">
                  Update your display name visible across administrative logs.
                </p>
              </div>

              {nameSuccess && (
                <div className="flex items-center gap-2 rounded-xl border border-brand-green/30 bg-brand-green/10 p-3 text-xs font-semibold text-brand-green">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{nameSuccess}</span>
                </div>
              )}
              {nameError && (
                <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{nameError}</span>
                </div>
              )}

              <form onSubmit={handleUpdateName} className="space-y-4">
                <div>
                  <label htmlFor="admin-name" className="text-xs font-bold text-brand-text block mb-1.5">
                    Display Name
                  </label>
                  <input
                    id="admin-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-2xl border border-brand-border/70 bg-brand-surface/75 px-4 py-2.5 text-sm text-brand-text outline-none focus:border-brand-green/50 focus:ring-4 focus:ring-brand-green/10"
                    placeholder="Administrator Name"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-brand-text block mb-1.5">
                    Email Address <span className="text-[10px] text-brand-muted font-normal">(Primary System ID)</span>
                  </label>
                  <input
                    type="email"
                    value={user.email}
                    disabled
                    className="w-full rounded-2xl border border-brand-border/40 bg-brand-bgAlt/50 px-4 py-2.5 text-sm text-brand-muted cursor-not-allowed"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={isSavingName}
                    className="px-6 py-2.5 text-xs font-bold shadow-md"
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </Card>

            {/* Change Password Card */}
            <Card className="p-6 space-y-5">
              <div>
                <p className="portal-section-label">Account Security</p>
                <h3 className="font-display text-base font-bold text-brand-text mt-1">Change Password</h3>
                <p className="text-xs text-brand-muted mt-0.5">
                  Ensure your administrator account uses a strong, unique password.
                </p>
              </div>

              {passwordSuccess && (
                <div className="flex items-center gap-2 rounded-xl border border-brand-green/30 bg-brand-green/10 p-3 text-xs font-semibold text-brand-green">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}
              {passwordError && (
                <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <label htmlFor="current-pw" className="text-xs font-bold text-brand-text block mb-1.5">
                    Current Password
                  </label>
                  <PasswordInput
                    id="current-pw"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>

                <div>
                  <label htmlFor="new-pw" className="text-xs font-bold text-brand-text block mb-1.5">
                    New Password
                  </label>
                  <PasswordInput
                    id="new-pw"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                </div>

                <div>
                  <label htmlFor="confirm-pw" className="text-xs font-bold text-brand-text block mb-1.5">
                    Confirm New Password
                  </label>
                  <PasswordInput
                    id="confirm-pw"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={isUpdatingPassword}
                    className="px-6 py-2.5 text-xs font-bold shadow-md"
                  >
                    Update Password
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          {/* Right Column: Session & Sign Out (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Account Session Card with Logout */}
            <div className="rounded-3xl border-2 border-red-500/20 bg-red-500/[0.035] p-6 space-y-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
                  <LogOut className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold text-brand-text">Account Session</h3>
                  <p className="text-[11px] text-brand-muted">Active administrator authentication</p>
                </div>
              </div>

              <div className="rounded-2xl border border-brand-border/60 bg-brand-surface p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-brand-muted">Signed In As</span>
                  <span className="font-mono font-bold text-brand-text truncate max-w-[190px]">{user.email}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-brand-muted">Role Privilege</span>
                  <span className="font-bold text-brand-green">Root Administrator</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-brand-muted">Device Session</span>
                  <span className="font-mono text-brand-muted">Current Browser</span>
                </div>
              </div>

              <p className="text-xs text-brand-muted leading-relaxed">
                Signing out terminates your current security token and locks access to platform analytics, accounts, and
                nutritionist license screening.
              </p>

              <Button
                variant="secondary"
                onClick={logout}
                className="w-full py-3 text-xs font-bold flex items-center justify-center gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all shadow-xs"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out of Administrator Account</span>
              </Button>
            </div>

            {/* Governance & Policy Card */}
            <Card className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-brand-text">
                <ShieldAlert className="h-4 w-4 text-brand-accent" />
                <span>Administrative Policy</span>
              </div>
              <ul className="text-xs text-brand-muted space-y-2 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-brand-green font-bold">•</span>
                  <span>
                    All account modifications and RND verifications are permanently recorded in system audit logs.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-green font-bold">•</span>
                  <span>Never share root administrator credentials with unverified personnel.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-green font-bold">•</span>
                  <span>Always sign out when leaving this workstation unattended.</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <AvatarSettings visible={true} user={user} updateUserSession={updateUserSession} />
        </div>
      )}
    </div>
  );
}
