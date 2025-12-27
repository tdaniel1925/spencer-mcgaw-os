"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/auth-context";

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  status: string;
  notes: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

interface ClientContextType {
  // State
  clients: Client[];
  loading: boolean;

  // Actions
  refreshClients: () => Promise<void>;
  getClientById: (id: string) => Client | undefined;
  searchClients: (query: string) => Client[];

  // Computed
  activeClients: Client[];
  clientCount: number;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export function ClientProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch all clients
  const refreshClients = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch("/api/clients?limit=500");
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
      }
    } catch (error) {
      console.error("[ClientContext] Error fetching clients:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial fetch
  useEffect(() => {
    if (user?.id) {
      refreshClients();
    }
  }, [user?.id, refreshClients]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user) return;

    // Clean up existing subscription
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
    }

    // Subscribe to client changes
    const channel = supabase
      .channel("clients_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "clients"
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const newClient = payload.new as Client;
            setClients(prev => [newClient, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            const updatedClient = payload.new as Client;
            setClients(prev => prev.map(c =>
              c.id === updatedClient.id ? { ...c, ...updatedClient } : c
            ));
          } else if (payload.eventType === "DELETE") {
            const deletedClient = payload.old as Client;
            setClients(prev => prev.filter(c => c.id !== deletedClient.id));
          }
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [user, supabase]);

  // Get client by ID
  const getClientById = useCallback((id: string) => {
    return clients.find(c => c.id === id);
  }, [clients]);

  // Search clients by name, email, or phone
  const searchClients = useCallback((query: string) => {
    if (!query.trim()) return clients;
    const lowerQuery = query.toLowerCase();
    return clients.filter(c =>
      c.name?.toLowerCase().includes(lowerQuery) ||
      c.email?.toLowerCase().includes(lowerQuery) ||
      c.phone?.includes(query)
    );
  }, [clients]);

  // Active clients (status = active)
  const activeClients = clients.filter(c => c.status === "active");

  // Total client count
  const clientCount = clients.length;

  return (
    <ClientContext.Provider
      value={{
        clients,
        loading,
        refreshClients,
        getClientById,
        searchClients,
        activeClients,
        clientCount,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
}

export function useClientContext() {
  const context = useContext(ClientContext);
  if (context === undefined) {
    throw new Error("useClientContext must be used within a ClientProvider");
  }
  return context;
}
