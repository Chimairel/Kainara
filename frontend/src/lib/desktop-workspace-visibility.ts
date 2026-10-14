'use client';
import { createContext, useContext } from 'react';

// Presentation only. Server claim, authorization and revision guards stay active.
export const DesktopWorkspaceVisibility = createContext(true);
export const useDesktopWorkspaceVisible = () => useContext(DesktopWorkspaceVisibility);
