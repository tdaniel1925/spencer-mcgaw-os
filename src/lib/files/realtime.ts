/**
 * Real-time file synchronization using Supabase Realtime
 *
 * Features:
 * - Live updates when files are uploaded, deleted, or modified
 * - Real-time folder changes
 * - Subscription management
 * - Conflict resolution
 */

import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type FileChangeType = "INSERT" | "UPDATE" | "DELETE";

export interface FileChangeEvent {
  type: FileChangeType;
  fileId: string;
  fileName: string;
  folderId: string | null;
  userId: string;
}

export interface FolderChangeEvent {
  type: FileChangeType;
  folderId: string;
  folderName: string;
  parentId: string | null;
  userId: string;
}

type FileChangeCallback = (event: FileChangeEvent) => void;
type FolderChangeCallback = (event: FolderChangeEvent) => void;

/**
 * Subscribe to real-time file changes in a specific folder (or all files if no folder specified)
 */
export function subscribeToFileChanges(
  callback: FileChangeCallback,
  folderId?: string | null
): RealtimeChannel {
  const supabase = createClient();

  // Build channel name
  const channelName = folderId
    ? `files:folder:${folderId}`
    : 'files:all';

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*', // Listen to all events: INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'files',
        filter: folderId ? `folder_id=eq.${folderId}` : undefined,
      },
      (payload) => {
        const eventType = payload.eventType as FileChangeType;
        const record = (payload.new || payload.old) as any;

        if (!record) return;

        callback({
          type: eventType,
          fileId: record.id,
          fileName: record.name,
          folderId: record.folder_id,
          userId: record.owner_id || record.created_by,
        });
      }
    )
    .subscribe();

  return channel;
}

/**
 * Subscribe to real-time folder changes
 */
export function subscribeToFolderChanges(
  callback: FolderChangeCallback,
  parentId?: string | null
): RealtimeChannel {
  const supabase = createClient();

  const channelName = parentId
    ? `folders:parent:${parentId}`
    : 'folders:all';

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'folders',
        filter: parentId ? `parent_id=eq.${parentId}` : undefined,
      },
      (payload) => {
        const eventType = payload.eventType as FileChangeType;
        const record = (payload.new || payload.old) as any;

        if (!record) return;

        callback({
          type: eventType,
          folderId: record.id,
          folderName: record.name,
          parentId: record.parent_id,
          userId: record.owner_id || record.created_by,
        });
      }
    )
    .subscribe();

  return channel;
}

/**
 * Subscribe to both file and folder changes
 */
export function subscribeToAllChanges(
  onFileChange: FileChangeCallback,
  onFolderChange: FolderChangeCallback,
  currentFolderId?: string | null
): { fileChannel: RealtimeChannel; folderChannel: RealtimeChannel } {
  const fileChannel = subscribeToFileChanges(onFileChange, currentFolderId);
  const folderChannel = subscribeToFolderChanges(onFolderChange, currentFolderId);

  return { fileChannel, folderChannel };
}

/**
 * Unsubscribe from a channel
 */
export async function unsubscribeFromChannel(channel: RealtimeChannel): Promise<void> {
  await channel.unsubscribe();
}

/**
 * Unsubscribe from multiple channels
 */
export async function unsubscribeFromChannels(channels: RealtimeChannel[]): Promise<void> {
  await Promise.all(channels.map(channel => channel.unsubscribe()));
}
