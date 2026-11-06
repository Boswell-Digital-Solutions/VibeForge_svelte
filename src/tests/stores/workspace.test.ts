import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { workspaceStore } from "$lib/core/stores/workspace.svelte";
import * as sync from "$lib/core/sync";
import type { Workspace } from "$lib/core/types";

// The store is offline-first: it reads and writes through the sync layer, not
// the raw API client. Mock what it actually depends on.
vi.mock("$lib/core/sync", () => ({
  listWorkspaces: vi.fn(),
  saveWorkspace: vi.fn(),
  deleteWorkspace: vi.fn(),
  getWorkspace: vi.fn(),
  syncAll: vi.fn().mockResolvedValue({ synced: 0, failed: 0, conflicts: [] }),
  getOnlineStatus: vi.fn(() => true),
  initWebSocketSync: vi.fn(() => ({ subscribe: vi.fn(() => () => {}) })),
}));

describe("Workspace Store", () => {
  const mockWorkspace: Workspace = {
    id: "ws-1",
    name: "Test Workspace",
    description: "A test workspace",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    settings: {
      theme: "dark",
      autoSave: true,
      defaultModel: "gpt-4",
    },
  };

  const mockWorkspace2: Workspace = {
    id: "ws-2",
    name: "Another Workspace",
    description: "Another test workspace",
    createdAt: "2025-01-02T00:00:00Z",
    updatedAt: "2025-01-02T00:00:00Z",
    settings: {
      theme: "light",
      autoSave: false,
    },
  };

  beforeEach(() => {
    // Clear any previous state
    workspaceStore.clearWorkspace();
    workspaceStore.clearError();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  describe("Initialization", () => {
    it("should initialize with empty state", () => {
      expect(workspaceStore.workspaces).toEqual([]);
      expect(workspaceStore.current).toBeNull();
      expect(workspaceStore.isLoading).toBe(false);
      expect(workspaceStore.isSaving).toBe(false);
      expect(workspaceStore.error).toBeNull();
    });

    it("should initialize derived state as null", () => {
      expect(workspaceStore.workspaceId).toBeUndefined();
      expect(workspaceStore.theme).toBe("dark");
      expect(workspaceStore.autoSave).toBe(true);
    });
  });

  // ============================================================================
  // BASIC SETTERS
  // ============================================================================

  describe("setWorkspace", () => {
    it("should set current workspace", () => {
      workspaceStore.setWorkspace(mockWorkspace);
      expect(workspaceStore.current).toEqual(mockWorkspace);
    });

    it("should clear error when setting workspace", () => {
      workspaceStore.setError("Test error");
      workspaceStore.setWorkspace(mockWorkspace);
      expect(workspaceStore.error).toBeNull();
    });
  });

  describe("setLoading", () => {
    it("should set loading state to true", () => {
      workspaceStore.setLoading(true);
      expect(workspaceStore.isLoading).toBe(true);
    });

    it("should set loading state to false", () => {
      workspaceStore.setLoading(true);
      workspaceStore.setLoading(false);
      expect(workspaceStore.isLoading).toBe(false);
    });
  });

  describe("setError", () => {
    it("should set error message", () => {
      workspaceStore.setError("Test error");
      expect(workspaceStore.error).toBe("Test error");
    });

    it("should clear error message", () => {
      workspaceStore.setError("Test error");
      workspaceStore.setError(null);
      expect(workspaceStore.error).toBeNull();
    });
  });

  describe("clearWorkspace", () => {
    it("should clear current workspace", () => {
      workspaceStore.setWorkspace(mockWorkspace);
      workspaceStore.clearWorkspace();
      expect(workspaceStore.current).toBeNull();
    });

    it("should clear error", () => {
      workspaceStore.setError("Test error");
      workspaceStore.clearWorkspace();
      expect(workspaceStore.error).toBeNull();
    });
  });

  describe("clearError", () => {
    it("should clear error message", () => {
      workspaceStore.setError("Test error");
      workspaceStore.clearError();
      expect(workspaceStore.error).toBeNull();
    });
  });

  // ============================================================================
  // DERIVED STATE
  // ============================================================================

  describe("Derived State", () => {
    it("should derive workspaceId from current workspace", () => {
      workspaceStore.setWorkspace(mockWorkspace);
      expect(workspaceStore.workspaceId).toBe("ws-1");
    });

    it("should derive theme from current workspace settings", () => {
      workspaceStore.setWorkspace(mockWorkspace);
      expect(workspaceStore.theme).toBe("dark");
    });

    it("should default theme to dark when no current workspace", () => {
      expect(workspaceStore.theme).toBe("dark");
    });

    it("should derive autoSave from current workspace settings", () => {
      workspaceStore.setWorkspace(mockWorkspace);
      expect(workspaceStore.autoSave).toBe(true);
    });

    it("should default autoSave to true when no current workspace", () => {
      expect(workspaceStore.autoSave).toBe(true);
    });
  });

  // ============================================================================
  // UPDATE SETTINGS
  // ============================================================================

  describe("updateSettings", () => {
    it("should update workspace settings", () => {
      workspaceStore.setWorkspace(mockWorkspace);
      workspaceStore.updateSettings({ theme: "light" });
      expect(workspaceStore.current?.settings.theme).toBe("light");
      expect(workspaceStore.current?.settings.autoSave).toBe(true);
    });

    it("should merge settings with existing ones", () => {
      workspaceStore.setWorkspace(mockWorkspace);
      workspaceStore.updateSettings({ autoSave: false });
      expect(workspaceStore.current?.settings.theme).toBe("dark");
      expect(workspaceStore.current?.settings.autoSave).toBe(false);
    });

    it("should do nothing if no current workspace", () => {
      expect(() => {
        workspaceStore.updateSettings({ theme: "light" });
      }).not.toThrow();
    });
  });

  // ============================================================================
  // CRUD OPERATIONS - LOAD
  // ============================================================================

  describe("load", () => {
    it("should load workspaces successfully", async () => {
      const mockWorkspaces = [mockWorkspace, mockWorkspace2];
      vi.mocked(sync.listWorkspaces).mockResolvedValue(mockWorkspaces);

      await workspaceStore.load();

      expect(sync.listWorkspaces).toHaveBeenCalled();
      expect(workspaceStore.workspaces).toEqual(mockWorkspaces);
      expect(workspaceStore.error).toBeNull();
      expect(workspaceStore.isLoading).toBe(false);
    });

    it("should set loading state during load", async () => {
      vi.mocked(sync.listWorkspaces).mockImplementation(
        () =>
          new Promise((resolve) => {
            expect(workspaceStore.isLoading).toBe(true);
            resolve([]);
          })
      );

      await workspaceStore.load();
      expect(workspaceStore.isLoading).toBe(false);
    });

    it("should handle load error", async () => {
      const error = new Error("Failed to fetch workspaces");
      vi.mocked(sync.listWorkspaces).mockRejectedValue(error);

      await workspaceStore.load();

      expect(workspaceStore.error).toBe("Failed to fetch workspaces");
      expect(workspaceStore.isLoading).toBe(false);
    });

    it("should handle non-Error objects", async () => {
      vi.mocked(sync.listWorkspaces).mockRejectedValue("String error");

      await workspaceStore.load();

      expect(workspaceStore.error).toBe("Failed to load workspaces");
      expect(workspaceStore.isLoading).toBe(false);
    });
  });

  // ============================================================================
  // CRUD OPERATIONS - CREATE
  // ============================================================================

  describe("create", () => {
    const createRequest = {
      name: "New Workspace",
      description: "A new workspace",
    };

    it("should create workspace successfully", async () => {
      vi.mocked(sync.saveWorkspace).mockResolvedValue(mockWorkspace);

      const result = await workspaceStore.create(createRequest);

      expect(sync.saveWorkspace).toHaveBeenCalledWith(
        expect.objectContaining(createRequest)
      );
      expect(result).toEqual(mockWorkspace);
      expect(workspaceStore.workspaces).toHaveLength(1);
      expect(workspaceStore.workspaces[0]).toEqual(mockWorkspace);
      expect(workspaceStore.current).toEqual(mockWorkspace);
      expect(workspaceStore.error).toBeNull();
      expect(workspaceStore.isSaving).toBe(false);
    });

    it("should prepend new workspace to list", async () => {
      // Set up initial workspaces
      vi.mocked(sync.listWorkspaces).mockResolvedValue([mockWorkspace2]);
      await workspaceStore.load();

      // Create new workspace
      vi.mocked(sync.saveWorkspace).mockResolvedValue(mockWorkspace);
      await workspaceStore.create(createRequest);

      expect(workspaceStore.workspaces[0]).toEqual(mockWorkspace);
      expect(workspaceStore.workspaces[1]).toEqual(mockWorkspace2);
    });

    it("should set saving state during create", async () => {
      vi.mocked(sync.saveWorkspace).mockImplementation(
        () =>
          new Promise((resolve) => {
            expect(workspaceStore.isSaving).toBe(true);
            resolve(mockWorkspace);
          })
      );

      await workspaceStore.create(createRequest);
      expect(workspaceStore.isSaving).toBe(false);
    });

    it("should handle create error", async () => {
      const error = new Error("Failed to create");
      vi.mocked(sync.saveWorkspace).mockRejectedValue(error);

      await expect(workspaceStore.create(createRequest)).rejects.toThrow(error);
      expect(workspaceStore.error).toBe("Failed to create");
      expect(workspaceStore.isSaving).toBe(false);
    });

    it("should handle non-Error create failure", async () => {
      vi.mocked(sync.saveWorkspace).mockRejectedValue("String error");

      await expect(workspaceStore.create(createRequest)).rejects.toBe("String error");
      expect(workspaceStore.error).toBe("Failed to create workspace");
    });
  });

  // ============================================================================
  // CRUD OPERATIONS - UPDATE
  // ============================================================================

  describe("update", () => {
    const updateData = { name: "Updated Workspace" };

    beforeEach(async () => {
      // Set up initial workspaces
      vi.mocked(sync.listWorkspaces).mockResolvedValue([
        mockWorkspace,
        mockWorkspace2,
      ]);
      await workspaceStore.load();
      workspaceStore.setWorkspace(mockWorkspace);
    });

    it("should update workspace successfully", async () => {
      const updatedWorkspace = { ...mockWorkspace, name: "Updated Workspace" };
      vi.mocked(sync.saveWorkspace).mockResolvedValue(updatedWorkspace);

      const result = await workspaceStore.update("ws-1", updateData);

      expect(sync.saveWorkspace).toHaveBeenCalledWith(
        expect.objectContaining({ id: "ws-1", ...updateData })
      );
      expect(result).toEqual(updatedWorkspace);
      expect(workspaceStore.error).toBeNull();
      expect(workspaceStore.isSaving).toBe(false);
    });

    it("should update workspace in list", async () => {
      const updatedWorkspace = { ...mockWorkspace, name: "Updated Workspace" };
      vi.mocked(sync.saveWorkspace).mockResolvedValue(updatedWorkspace);

      await workspaceStore.update("ws-1", updateData);

      const found = workspaceStore.workspaces.find((w) => w.id === "ws-1");
      expect(found?.name).toBe("Updated Workspace");
    });

    it("should update current workspace if it matches", async () => {
      const updatedWorkspace = { ...mockWorkspace, name: "Updated Workspace" };
      vi.mocked(sync.saveWorkspace).mockResolvedValue(updatedWorkspace);

      await workspaceStore.update("ws-1", updateData);

      expect(workspaceStore.current?.name).toBe("Updated Workspace");
    });

    it("should not update current if different workspace", async () => {
      const updatedWorkspace = { ...mockWorkspace2, name: "Updated Workspace 2" };
      vi.mocked(sync.saveWorkspace).mockResolvedValue(updatedWorkspace);

      await workspaceStore.update("ws-2", updateData);

      expect(workspaceStore.current?.id).toBe("ws-1");
      expect(workspaceStore.current?.name).toBe("Test Workspace");
    });

    it("should set saving state during update", async () => {
      const updatedWorkspace = { ...mockWorkspace, name: "Updated" };
      vi.mocked(sync.saveWorkspace).mockImplementation(
        () =>
          new Promise((resolve) => {
            expect(workspaceStore.isSaving).toBe(true);
            resolve(updatedWorkspace);
          })
      );

      await workspaceStore.update("ws-1", updateData);
      expect(workspaceStore.isSaving).toBe(false);
    });

    it("should handle update error", async () => {
      const error = new Error("Failed to update");
      vi.mocked(sync.saveWorkspace).mockRejectedValue(error);

      await expect(workspaceStore.update("ws-1", updateData)).rejects.toThrow(error);
      expect(workspaceStore.error).toBe("Failed to update");
      expect(workspaceStore.isSaving).toBe(false);
    });

    it("should handle non-Error update failure", async () => {
      vi.mocked(sync.saveWorkspace).mockRejectedValue("String error");

      await expect(workspaceStore.update("ws-1", updateData)).rejects.toBe("String error");
      expect(workspaceStore.error).toBe("Failed to update workspace");
    });
  });

  // ============================================================================
  // CRUD OPERATIONS - REMOVE
  // ============================================================================

  describe("remove", () => {
    beforeEach(async () => {
      // Set up initial workspaces
      vi.mocked(sync.listWorkspaces).mockResolvedValue([
        mockWorkspace,
        mockWorkspace2,
      ]);
      await workspaceStore.load();
    });

    it("should delete workspace successfully", async () => {
      vi.mocked(sync.deleteWorkspace).mockResolvedValue(undefined);

      await workspaceStore.remove("ws-1");

      expect(sync.deleteWorkspace).toHaveBeenCalledWith("ws-1");
      expect(workspaceStore.workspaces).not.toContain(mockWorkspace);
      expect(workspaceStore.workspaces).toHaveLength(1);
      expect(workspaceStore.error).toBeNull();
      expect(workspaceStore.isSaving).toBe(false);
    });

    it("should clear current workspace if it matches deleted one", async () => {
      workspaceStore.setWorkspace(mockWorkspace);
      vi.mocked(sync.deleteWorkspace).mockResolvedValue(undefined);

      await workspaceStore.remove("ws-1");

      expect(workspaceStore.current).toBeNull();
    });

    it("should not clear current if different workspace deleted", async () => {
      workspaceStore.setWorkspace(mockWorkspace);
      vi.mocked(sync.deleteWorkspace).mockResolvedValue(undefined);

      await workspaceStore.remove("ws-2");

      expect(workspaceStore.current).toEqual(mockWorkspace);
    });

    it("should set saving state during delete", async () => {
      vi.mocked(sync.deleteWorkspace).mockImplementation(
        () =>
          new Promise((resolve) => {
            expect(workspaceStore.isSaving).toBe(true);
            resolve(undefined);
          })
      );

      await workspaceStore.remove("ws-1");
      expect(workspaceStore.isSaving).toBe(false);
    });

    it("should handle delete error", async () => {
      const error = new Error("Failed to delete");
      vi.mocked(sync.deleteWorkspace).mockRejectedValue(error);

      await expect(workspaceStore.remove("ws-1")).rejects.toThrow(error);
      expect(workspaceStore.error).toBe("Failed to delete");
      expect(workspaceStore.isSaving).toBe(false);
    });

    it("should handle non-Error delete failure", async () => {
      vi.mocked(sync.deleteWorkspace).mockRejectedValue("String error");

      await expect(workspaceStore.remove("ws-1")).rejects.toBe("String error");
      expect(workspaceStore.error).toBe("Failed to delete workspace");
    });
  });
});
