/**
 * FileService Tests
 *
 * Tests for file-service.ts business logic layer
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { FileService } from "@/lib/files/file-service";

// Mock fetch globally
global.fetch = vi.fn();

describe("FileService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("uploadFile", () => {
    it("should send file via FormData", async () => {
      const mockFile = new File(["content"], "test.txt", { type: "text/plain" });
      const mockResponse = {
        file: {
          id: "file-1",
          name: "test.txt",
          size: 7,
          mimeType: "text/plain",
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await FileService.uploadFile({ file: mockFile });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/files",
        expect.objectContaining({
          method: "POST",
          body: expect.any(FormData),
        })
      );

      expect(result).toEqual(mockResponse.file);
    });

    it("should include folderId in FormData", async () => {
      const mockFile = new File(["content"], "test.txt");
      const folderId = "folder-123";

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ file: { id: "file-1" } }),
      });

      await FileService.uploadFile({ file: mockFile, folderId });

      const callArgs = (global.fetch as any).mock.calls[0];
      const formData = callArgs[1].body;

      expect(formData).toBeInstanceOf(FormData);
    });

    it("should throw on upload error", async () => {
      const mockFile = new File(["content"], "test.txt");

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Upload failed" }),
      });

      await expect(FileService.uploadFile({ file: mockFile })).rejects.toThrow("Upload failed");
    });
  });

  describe("listFiles", () => {
    it("should build query params correctly", async () => {
      const options = {
        folderId: "folder-1",
        search: "test",
        sort: "name" as const,
        order: "asc" as const,
        limit: 50,
        offset: 100,
        starred: true,
        trashed: false,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [], total: 0, limit: 50, offset: 100 }),
      });

      await FileService.listFiles(options);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/files?"),
        undefined
      );

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain("folderId=folder-1");
      expect(callUrl).toContain("search=test");
      expect(callUrl).toContain("sort=name");
      expect(callUrl).toContain("order=asc");
      expect(callUrl).toContain("limit=50");
      expect(callUrl).toContain("offset=100");
      expect(callUrl).toContain("starred=true");
      expect(callUrl).toContain("trashed=false");
    });

    it("should handle empty options", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [], total: 0, limit: 100, offset: 0 }),
      });

      await FileService.listFiles();

      expect(global.fetch).toHaveBeenCalledWith("/api/files?", undefined);
    });
  });

  describe("getFile", () => {
    it("should fetch file metadata", async () => {
      const fileId = "file-123";
      const mockFile = { id: fileId, name: "test.txt" };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ file: mockFile }),
      });

      const result = await FileService.getFile(fileId);

      expect(global.fetch).toHaveBeenCalledWith(`/api/files/${fileId}`);
      expect(result).toEqual(mockFile);
    });
  });

  describe("updateFile", () => {
    it("should send PATCH request with updates", async () => {
      const fileId = "file-123";
      const updates = {
        name: "renamed.txt",
        folderId: "folder-456",
        isStarred: true,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ file: { id: fileId, ...updates } }),
      });

      const result = await FileService.updateFile(fileId, updates);

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/files/${fileId}`,
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        })
      );

      expect(result.name).toBe(updates.name);
    });
  });

  describe("deleteFile", () => {
    it("should soft delete by default", async () => {
      const fileId = "file-123";

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await FileService.deleteFile(fileId);

      expect(global.fetch).toHaveBeenCalledWith(`/api/files/${fileId}`, { method: "DELETE" });
    });

    it("should permanent delete when specified", async () => {
      const fileId = "file-123";

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, permanent: true }),
      });

      await FileService.deleteFile(fileId, true);

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/files/${fileId}?permanent=true`,
        { method: "DELETE" }
      );
    });
  });

  describe("restoreFile", () => {
    it("should restore trashed file", async () => {
      const fileId = "file-123";
      const restoredFile = { id: fileId, is_trashed: false };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ file: restoredFile }),
      });

      const result = await FileService.restoreFile(fileId);

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/files/${fileId}/restore`,
        { method: "POST" }
      );
      expect(result.is_trashed).toBe(false);
    });
  });

  describe("downloadFile", () => {
    it("should return download URL", async () => {
      const fileId = "file-123";
      const downloadData = {
        downloadUrl: "https://storage.example.com/file",
        fileName: "test.txt",
        fileSize: 1000,
        mimeType: "text/plain",
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => downloadData,
      });

      const result = await FileService.downloadFile(fileId);

      expect(global.fetch).toHaveBeenCalledWith(`/api/files/${fileId}/download`);
      expect(result).toEqual(downloadData);
    });
  });

  describe("bulkDownload", () => {
    it("should download multiple files", async () => {
      const fileIds = ["file-1", "file-2", "file-3"];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          downloadUrl: "https://storage.example.com/file",
          fileName: "file.txt",
        }),
      });

      // Mock document.createElement
      const mockLink = {
        href: "",
        download: "",
        click: vi.fn(),
      };
      vi.spyOn(document, "createElement").mockReturnValue(mockLink as any);

      await FileService.bulkDownload(fileIds);

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(mockLink.click).toHaveBeenCalledTimes(3);
    });

    it("should throw if some downloads fail", async () => {
      const fileIds = ["file-1", "file-2"];

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ downloadUrl: "url1", fileName: "file1.txt" }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: "Failed" }),
        });

      vi.spyOn(document, "createElement").mockReturnValue({
        href: "",
        download: "",
        click: vi.fn(),
      } as any);

      await expect(FileService.bulkDownload(fileIds)).rejects.toThrow("Failed to download 1 file(s)");
    });
  });

  describe("Folder operations", () => {
    it("should create folder", async () => {
      const options = {
        name: "My Folder",
        parentId: null,
        folderType: "personal" as const,
      };

      const mockFolder = { id: "folder-1", ...options };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ folder: mockFolder }),
      });

      const result = await FileService.createFolder(options);

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/folders",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(options),
        })
      );

      expect(result).toEqual(mockFolder);
    });

    it("should list folders", async () => {
      const options = {
        parentId: "folder-parent",
        type: "team" as const,
        includeSubfolders: true,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ folders: [] }),
      });

      await FileService.listFolders(options);

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain("parentId=folder-parent");
      expect(callUrl).toContain("type=team");
      expect(callUrl).toContain("includeSubfolders=true");
    });

    it("should update folder", async () => {
      const folderId = "folder-123";
      const updates = {
        name: "Renamed Folder",
        parentId: "new-parent",
        color: "#ff0000",
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ folder: { id: folderId, ...updates } }),
      });

      const result = await FileService.updateFolder(folderId, updates);

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/folders/${folderId}`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify(updates),
        })
      );

      expect(result.name).toBe(updates.name);
    });

    it("should delete folder recursively", async () => {
      const folderId = "folder-123";
      const deleteResult = {
        deletedFiles: 10,
        deletedFolders: 3,
        freedBytes: 50000,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => deleteResult,
      });

      const result = await FileService.deleteFolder(folderId);

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/folders/${folderId}`,
        { method: "DELETE" }
      );

      expect(result).toEqual(deleteResult);
    });
  });

  describe("Helper methods", () => {
    it("searchFiles should call listFiles with search param", async () => {
      const query = "test";

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [], total: 0, limit: 100, offset: 0 }),
      });

      await FileService.searchFiles(query);

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain(`search=${query}`);
      expect(callUrl).toContain("limit=100");
    });

    it("getRecentFiles should sort by modified_at desc", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [], total: 0, limit: 20, offset: 0 }),
      });

      await FileService.getRecentFiles(20);

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain("sort=modified_at");
      expect(callUrl).toContain("order=desc");
      expect(callUrl).toContain("limit=20");
    });

    it("getStarredFiles should filter by starred=true", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [], total: 0, limit: 1000, offset: 0 }),
      });

      await FileService.getStarredFiles();

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain("starred=true");
    });

    it("getTrashedFiles should filter by trashed=true", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [], total: 0, limit: 1000, offset: 0 }),
      });

      await FileService.getTrashedFiles();

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain("trashed=true");
    });
  });

  describe("Error handling", () => {
    it("should throw descriptive errors", async () => {
      const errorMessage = "Quota exceeded";

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: errorMessage }),
      });

      await expect(FileService.getFile("file-1")).rejects.toThrow(errorMessage);
    });

    it("should throw generic error if no message", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      });

      await expect(FileService.getFile("file-1")).rejects.toThrow("Failed to get file");
    });
  });
});
