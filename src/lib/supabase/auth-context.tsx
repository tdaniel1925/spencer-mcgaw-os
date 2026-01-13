"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { createClient } from "./client";
import {
  UserRole,
  Permission,
  hasPermissionWithOverrides,
  canAccessRoute,
  PermissionOverride,
} from "@/lib/permissions";

export interface AuthUser extends User {
  role?: UserRole;
  full_name?: string;
  avatar_url?: string;
  department?: string;
  job_title?: string;
  phone?: string;
  is_active?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  permissionOverrides: PermissionOverride[];
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
  hasRole: (roles: UserRole[]) => boolean;
  can: (permission: Permission) => boolean;
  canAny: (permissions: Permission[]) => boolean;
  canAll: (permissions: Permission[]) => boolean;
  canAccessRoute: (href: string) => boolean;
  isAdmin: boolean;
  isManager: boolean;
  isOwner: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to check if error is an abort error (expected during navigation)
function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionOverrides, setPermissionOverrides] = useState<PermissionOverride[]>([]);
  const supabase = createClient();
  const isMounted = useRef(true);

  // Build user object from session user and optional profile
  // NOTE: Admin role is determined by the role field in user_profiles table, not hardcoded
  const buildUser = useCallback((sessionUser: User, profile?: Record<string, unknown> | null): AuthUser => {
    if (profile) {
      return {
        ...sessionUser,
        role: (profile.role as UserRole) || "staff",
        full_name: profile.full_name as string | undefined,
        avatar_url: profile.avatar_url as string | undefined,
        department: profile.department as string | undefined,
        job_title: profile.job_title as string | undefined,
        phone: profile.phone as string | undefined,
        is_active: (profile.is_active as boolean) ?? true,
      };
    }

    // No profile - use basic info from session (default to staff role)
    return {
      ...sessionUser,
      role: "staff",
      full_name: sessionUser.user_metadata?.full_name || sessionUser.email?.split("@")[0],
      is_active: true,
    };
  }, []);

  // Load user profile (called after session is set)
  const loadUserProfile = useCallback(async (sessionUser: User) => {
    if (!isMounted.current) return;

    try {
      const { data: profile, error } = await supabase
        .from("user_profiles")
        .select("role, full_name, avatar_url, department, job_title, phone, is_active")
        .eq("id", sessionUser.id)
        .single();

      if (!isMounted.current) return;

      // Profile not found - user might not have been provisioned yet
      if (error?.code === "PGRST116") {
        // Just use session data, don't sign out - profile might be created later
        setUser(buildUser(sessionUser, null));
        return;
      }

      setUser(buildUser(sessionUser, profile));

      // Load permission overrides in background (non-blocking)
      supabase
        .from("user_permission_overrides")
        .select("*")
        .eq("user_id", sessionUser.id)
        .then(({ data, error }) => {
          if (!error && isMounted.current && data) {
            const active = data.filter(o => !o.expires_at || new Date(o.expires_at) > new Date());
            setPermissionOverrides(active);
          }
        });

    } catch (err) {
      if (isAbortError(err) || !isMounted.current) return;
      // On error, still set user with basic info so app doesn't break
      setUser(buildUser(sessionUser, null));
    }
  }, [supabase, buildUser]);

  // Initialize auth on mount
  useEffect(() => {
    isMounted.current = true;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!isMounted.current) return;

        if (session?.user) {
          setSession(session);
          // Set basic user immediately so app can render
          setUser(buildUser(session.user, null));
          setLoading(false);
          // Load full profile in background
          loadUserProfile(session.user);
        } else {
          setSession(null);
          setUser(null);
          setLoading(false);
        }
      } catch (err) {
        if (isAbortError(err) || !isMounted.current) return;
        console.error("Error getting session:", err);
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted.current) return;

        setSession(session);

        if (session?.user) {
          // Set basic user immediately
          setUser(buildUser(session.user, null));
          setLoading(false);
          // Load full profile in background
          loadUserProfile(session.user);
        } else {
          setUser(null);
          setPermissionOverrides([]);
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
    };
  }, [supabase, buildUser, loadUserProfile]);

  // Refresh permissions
  const refreshPermissions = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase
        .from("user_permission_overrides")
        .select("*")
        .eq("user_id", user.id);
      if (data) {
        const active = data.filter(o => !o.expires_at || new Date(o.expires_at) > new Date());
        setPermissionOverrides(active);
      }
    } catch (err) {
      if (!isAbortError(err)) {
        console.error("Error refreshing permissions:", err);
      }
    }
  }, [user?.id, supabase]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (!error && data.user) {
      // Create user profile
      await supabase.from("user_profiles").insert({
        id: data.user.id,
        email: email,
        full_name: fullName,
        role: "staff",
        is_active: true,
      });
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setPermissionOverrides([]);
  };

  // Permission checks
  const checkHasRole = (roles: UserRole[]) => user?.role ? roles.includes(user.role) : false;
  const can = (permission: Permission) => hasPermissionWithOverrides(user?.role, permission, permissionOverrides);
  const canAny = (permissions: Permission[]) => permissions.some(p => can(p));
  const canAll = (permissions: Permission[]) => permissions.every(p => can(p));
  const checkCanAccessRoute = (href: string) => canAccessRoute(user?.role, href);

  // Role shortcuts
  const isOwner = user?.role === "owner";
  const isAdmin = user?.role === "admin" || isOwner;
  const isManager = user?.role === "manager" || isAdmin;
  const isAuthenticated = !!user && !!session;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        permissionOverrides,
        signIn,
        signUp,
        signOut,
        refreshPermissions,
        hasRole: checkHasRole,
        can,
        canAny,
        canAll,
        canAccessRoute: checkCanAccessRoute,
        isAdmin,
        isManager,
        isOwner,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
