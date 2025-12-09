"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { createClient } from "./client";
import {
  UserRole,
  Permission,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canAccessRoute,
} from "@/lib/permissions";

interface AuthUser extends User {
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
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo user for development/preview (shows all features)
const DEMO_USER: AuthUser = {
  id: "demo-user-id",
  email: "tdaniel@botmakers.ai",
  role: "admin",
  full_name: "Tyler Daniel",
  department: "Technology",
  job_title: "Administrator",
  is_active: true,
  aud: "authenticated",
  created_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: {},
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Start with demo user for development preview
  const [user, setUser] = useState<AuthUser | null>(DEMO_USER);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        if (session?.user) {
          // Fetch user profile with role and additional info
          const { data: profile, error } = await supabase
            .from("user_profiles")
            .select("role, full_name, avatar_url, department, job_title, phone, is_active")
            .eq("id", session.user.id)
            .single();

          // Only update user if we got valid profile data
          if (profile && !error) {
            // Override role for specific admin emails
            const adminEmails = ["tdaniel@botmakers.ai"];
            const userRole = adminEmails.includes(session.user.email || "")
              ? "admin"
              : (profile.role as UserRole) || "staff";

            setUser({
              ...session.user,
              role: userRole,
              full_name: profile.full_name,
              avatar_url: profile.avatar_url,
              department: profile.department,
              job_title: profile.job_title,
              phone: profile.phone,
              is_active: profile.is_active ?? true,
            });
          }
          // If no profile, keep demo user
        }
        // If no session, keep the demo user (already set as initial state)
      } catch {
        // On error, keep demo user
        console.log("Using demo user - no Supabase connection");
      }
      setLoading(false);
    };

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        if (session?.user) {
          const { data: profile, error } = await supabase
            .from("user_profiles")
            .select("role, full_name, avatar_url, department, job_title, phone, is_active")
            .eq("id", session.user.id)
            .single();

          // Only update user if we got valid profile data
          if (profile && !error) {
            // Override role for specific admin emails
            const adminEmails = ["tdaniel@botmakers.ai"];
            const userRole = adminEmails.includes(session.user.email || "")
              ? "admin"
              : (profile.role as UserRole) || "staff";

            setUser({
              ...session.user,
              role: userRole,
              full_name: profile.full_name,
              avatar_url: profile.avatar_url,
              department: profile.department,
              job_title: profile.job_title,
              phone: profile.phone,
              is_active: profile.is_active ?? true,
            });
          }
          // If no profile, keep current user (demo user)
        } else {
          // Fall back to demo user when no authenticated session
          setUser(DEMO_USER);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

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
    // Fall back to demo user after sign out
    setUser(DEMO_USER);
    setSession(null);
  };

  // Legacy role check
  const checkHasRole = (roles: UserRole[]) => {
    if (!user?.role) return false;
    return roles.includes(user.role);
  };

  // Permission-based checks
  const can = (permission: Permission) => hasPermission(user?.role, permission);
  const canAny = (permissions: Permission[]) => hasAnyPermission(user?.role, permissions);
  const canAll = (permissions: Permission[]) => hasAllPermissions(user?.role, permissions);
  const checkCanAccessRoute = (href: string) => canAccessRoute(user?.role, href);

  // Role shortcuts
  const isOwner = user?.role === "owner";
  const isAdmin = user?.role === "admin" || user?.role === "owner";
  const isManager = user?.role === "manager" || user?.role === "admin" || user?.role === "owner";

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        hasRole: checkHasRole,
        can,
        canAny,
        canAll,
        canAccessRoute: checkCanAccessRoute,
        isAdmin,
        isManager,
        isOwner,
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
