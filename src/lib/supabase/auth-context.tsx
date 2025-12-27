"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
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
  // Role-based helpers (legacy)
  hasRole: (roles: UserRole[]) => boolean;
  // Permission-based helpers
  can: (permission: Permission) => boolean;
  canAny: (permissions: Permission[]) => boolean;
  canAll: (permissions: Permission[]) => boolean;
  canAccessRoute: (href: string) => boolean;
  // User info helpers
  isAdmin: boolean;
  isManager: boolean;
  isOwner: boolean;
  // Authentication state
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Start with null - no user until authenticated
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionOverrides, setPermissionOverrides] = useState<PermissionOverride[]>([]);
  const supabase = createClient();

  // Function to load permission overrides for a user
  const loadPermissionOverrides = useCallback(async (userId: string) => {
    try {
      const { data: overrides, error } = await supabase
        .from("user_permission_overrides")
        .select("*")
        .eq("user_id", userId);

      if (!error && overrides) {
        // Filter out expired overrides
        const activeOverrides = overrides.filter(
          o => !o.expires_at || new Date(o.expires_at) > new Date()
        );
        setPermissionOverrides(activeOverrides);
      }
    } catch (err) {
      console.error("Error loading permission overrides:", err);
    }
  }, [supabase]);

  // Refresh permissions (can be called after admin changes)
  const refreshPermissions = useCallback(async () => {
    if (user?.id) {
      await loadPermissionOverrides(user.id);
    }
  }, [user?.id, loadPermissionOverrides]);

  // Helper to build user from session and profile
  const buildUser = useCallback((sessionUser: User, profile: Record<string, unknown> | null): AuthUser => {
    const adminEmails = ["tdaniel@botmakers.ai"];

    if (profile) {
      const userRole = adminEmails.includes(sessionUser.email || "")
        ? "admin"
        : (profile.role as UserRole) || "staff";

      return {
        ...sessionUser,
        role: userRole,
        full_name: profile.full_name as string | undefined,
        avatar_url: profile.avatar_url as string | undefined,
        department: profile.department as string | undefined,
        job_title: profile.job_title as string | undefined,
        phone: profile.phone as string | undefined,
        is_active: (profile.is_active as boolean) ?? true,
      };
    }

    // No profile - use basic info
    return {
      ...sessionUser,
      role: adminEmails.includes(sessionUser.email || "") ? "admin" : "staff",
      full_name: sessionUser.user_metadata?.full_name || sessionUser.email?.split("@")[0],
      is_active: true,
    };
  }, []);

  useEffect(() => {
    // Get initial session - OPTIMIZED: parallel queries for faster loading
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);

        if (session?.user) {
          // Fetch profile and permissions in PARALLEL for faster loading
          const [profileResult, overridesResult] = await Promise.all([
            supabase
              .from("user_profiles")
              .select("role, full_name, avatar_url, department, job_title, phone, is_active")
              .eq("id", session.user.id)
              .single(),
            supabase
              .from("user_permission_overrides")
              .select("*")
              .eq("user_id", session.user.id)
          ]);

          const { data: profile, error: profileError } = profileResult;

          // If user doesn't exist in database, sign them out immediately
          if (profileError && profileError.code === "PGRST116") {
            console.warn("Session exists but user not found in database. Clearing stale session.");
            await supabase.auth.signOut();
            setUser(null);
            setSession(null);
            setPermissionOverrides([]);
            setLoading(false);
            return;
          }

          // User exists - set user data and permissions together
          setUser(buildUser(session.user, profile));

          if (overridesResult.data) {
            const activeOverrides = overridesResult.data.filter(
              (o: PermissionOverride) => !o.expires_at || new Date(o.expires_at) > new Date()
            );
            setPermissionOverrides(activeOverrides);
          }

          setLoading(false);
        } else {
          setUser(null);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error getting session:", err);
        setUser(null);
        setLoading(false);
      }
    };

    getSession();

    // Listen for auth changes - OPTIMIZED: parallel queries
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);

        if (session?.user) {
          // Fetch profile and permissions in PARALLEL
          const [profileResult, overridesResult] = await Promise.all([
            supabase
              .from("user_profiles")
              .select("role, full_name, avatar_url, department, job_title, phone, is_active")
              .eq("id", session.user.id)
              .single(),
            supabase
              .from("user_permission_overrides")
              .select("*")
              .eq("user_id", session.user.id)
          ]);

          const { data: profile, error: profileError } = profileResult;

          // If user doesn't exist in database, sign them out
          if (profileError && profileError.code === "PGRST116") {
            console.warn("Auth state changed but user not found in database. Clearing session.");
            await supabase.auth.signOut();
            setUser(null);
            setSession(null);
            setPermissionOverrides([]);
            setLoading(false);
            return;
          }

          // User exists - set user data and permissions together
          setUser(buildUser(session.user, profile));

          if (overridesResult.data) {
            const activeOverrides = overridesResult.data.filter(
              (o: PermissionOverride) => !o.expires_at || new Date(o.expires_at) > new Date()
            );
            setPermissionOverrides(activeOverrides);
          }

          setLoading(false);
        } else {
          setUser(null);
          setPermissionOverrides([]);
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, loadPermissionOverrides, buildUser]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (!error && data.user) {
      // Create user profile in user_profiles table
      await supabase.from("user_profiles").insert({
        id: data.user.id,
        email: email,
        full_name: fullName,
        role: "staff", // Default role
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

  // Legacy role check
  const checkHasRole = (roles: UserRole[]) => {
    if (!user?.role) return false;
    return roles.includes(user.role);
  };

  // Permission-based checks with overrides
  const can = (permission: Permission) =>
    hasPermissionWithOverrides(user?.role, permission, permissionOverrides);

  const canAny = (permissions: Permission[]) =>
    permissions.some(p => hasPermissionWithOverrides(user?.role, p, permissionOverrides));

  const canAll = (permissions: Permission[]) =>
    permissions.every(p => hasPermissionWithOverrides(user?.role, p, permissionOverrides));

  const checkCanAccessRoute = (href: string) => canAccessRoute(user?.role, href);

  // Role shortcuts
  const isOwner = user?.role === "owner";
  const isAdmin = user?.role === "admin" || user?.role === "owner";
  const isManager = user?.role === "manager" || user?.role === "admin" || user?.role === "owner";
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
