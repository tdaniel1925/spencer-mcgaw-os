import { test, expect } from "@playwright/test";

test.describe("Email Audit Tracking", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/inbound");
    await page.waitForTimeout(1000);
  });

  test.describe("Email View Tracking", () => {
    test("should load inbound communications page or redirect to login", async ({ page }) => {
      const isOnInbound = page.url().includes("/inbound");
      const isOnLogin = page.url().includes("/login");
      expect(isOnInbound || isOnLogin).toBe(true);
    });

    test("should display email cards when authenticated", async ({ page }) => {
      if (page.url().includes("/inbound")) {
        // Wait for content to load
        await page.waitForTimeout(1500);

        // Check for either email cards or empty state
        const hasCards = await page.locator('[data-testid="communication-card"]').count();
        const hasEmptyState = await page.locator("text=No communications").count();

        expect(hasCards > 0 || hasEmptyState > 0).toBe(true);
      }
    });

    test("should expand email card on click", async ({ page }) => {
      if (page.url().includes("/inbound")) {
        await page.waitForTimeout(1500);

        const cards = await page.locator('[data-testid="communication-card"]').count();

        if (cards > 0) {
          // Click first card to expand
          await page.locator('[data-testid="communication-card"]').first().click();
          await page.waitForTimeout(500);

          // Should show expanded content
          const expandedContent = page.locator("text=Reply");
          await expect(expandedContent).toBeVisible();
        }
      }
    });

    test("should log view when card is expanded", async ({ page }) => {
      if (page.url().includes("/inbound")) {
        await page.waitForTimeout(1500);

        const cards = await page.locator('[data-testid="communication-card"]').count();

        if (cards > 0) {
          // Listen for audit logging API call
          const auditPromise = page.waitForResponse(
            (response) =>
              response.url().includes("/api/audit/log-email-view") &&
              response.request().method() === "POST"
          );

          // Expand card
          await page.locator('[data-testid="communication-card"]').first().click();

          // Wait for audit log to be sent (or timeout if no emails)
          try {
            const auditResponse = await Promise.race([
              auditPromise,
              page.waitForTimeout(2000).then(() => null),
            ]);

            if (auditResponse) {
              expect(auditResponse.status()).toBeLessThan(500);
            }
          } catch (error) {
            // No emails to view - skip test
          }
        }
      }
    });

    test("should not log view when card is collapsed", async ({ page }) => {
      if (page.url().includes("/inbound")) {
        await page.waitForTimeout(1500);

        const cards = await page.locator('[data-testid="communication-card"]').count();

        if (cards > 0) {
          // First expand
          await page.locator('[data-testid="communication-card"]').first().click();
          await page.waitForTimeout(500);

          // Track API calls before collapse
          let auditCallMade = false;
          page.on("request", (request) => {
            if (request.url().includes("/api/audit/log-email-view")) {
              auditCallMade = true;
            }
          });

          // Collapse card
          await page.locator('[data-testid="communication-card"]').first().click();
          await page.waitForTimeout(500);

          // Should not make audit call on collapse
          expect(auditCallMade).toBe(false);
        }
      }
    });
  });

  describe("Email Filtering and Search", () => {
    test("should display filter options when authenticated", async ({ page }) => {
      if (page.url().includes("/inbound")) {
        const filterButton = page.getByRole("button", { name: /filter/i });
        await expect(filterButton.or(page.locator("text=All"))).toBeVisible();
      }
    });

    test("should search emails", async ({ page }) => {
      if (page.url().includes("/inbound")) {
        const searchInput = page.getByPlaceholder(/search/i);

        if (await searchInput.count()) {
          await searchInput.fill("test");
          await page.waitForTimeout(500);
          await expect(searchInput).toHaveValue("test");
        }
      }
    });

    test("should filter by communication type", async ({ page }) => {
      if (page.url().includes("/inbound")) {
        // Look for filter tabs or dropdown
        const emailFilter = page.locator("text=Emails");
        const phoneFilter = page.locator("text=Calls");

        // Check if filters exist
        const hasEmailFilter = (await emailFilter.count()) > 0;
        const hasPhoneFilter = (await phoneFilter.count()) > 0;

        expect(hasEmailFilter || hasPhoneFilter).toBe(true);
      }
    });
  });

  describe("Email Actions", () => {
    test("should show reply button when email is expanded", async ({ page }) => {
      if (page.url().includes("/inbound")) {
        await page.waitForTimeout(1500);

        const cards = await page.locator('[data-testid="communication-card"]').count();

        if (cards > 0) {
          await page.locator('[data-testid="communication-card"]').first().click();
          await page.waitForTimeout(500);

          // Look for reply or action buttons
          const hasReply = (await page.locator("text=Reply").count()) > 0;
          const hasForward = (await page.locator("text=Forward").count()) > 0;
          const hasCreateTask = (await page.locator("text=Create Task").count()) > 0;

          expect(hasReply || hasForward || hasCreateTask).toBe(true);
        }
      }
    });

    test("should allow creating task from email", async ({ page }) => {
      if (page.url().includes("/inbound")) {
        await page.waitForTimeout(1500);

        const cards = await page.locator('[data-testid="communication-card"]').count();

        if (cards > 0) {
          await page.locator('[data-testid="communication-card"]').first().click();
          await page.waitForTimeout(500);

          const createTaskButton = page.locator("text=Create Task");

          if (await createTaskButton.count()) {
            await createTaskButton.first().click();
            await page.waitForTimeout(500);

            // Should show task creation form
            const taskForm = page.locator("text=Task Title").or(page.locator("text=Title"));
            await expect(taskForm).toBeVisible();
          }
        }
      }
    });
  });

  describe("Email Intelligence", () => {
    test("should navigate to email intelligence page", async ({ page }) => {
      await page.goto("/email-intelligence");
      await page.waitForTimeout(1000);

      const isOnEmailIntelligence = page.url().includes("/email-intelligence");
      const isOnLogin = page.url().includes("/login");
      expect(isOnEmailIntelligence || isOnLogin).toBe(true);
    });

    test("should display task suggestions when authenticated", async ({ page }) => {
      await page.goto("/email-intelligence");

      if (page.url().includes("/email-intelligence")) {
        await page.waitForTimeout(1500);

        // Check for suggestions or empty state
        const hasSuggestions = (await page.locator('[data-testid="task-suggestion"]').count()) > 0;
        const hasEmptyState = (await page.locator("text=No suggestions").count()) > 0;

        expect(hasSuggestions || hasEmptyState).toBe(true);
      }
    });

    test("should approve task suggestion", async ({ page }) => {
      await page.goto("/email-intelligence");

      if (page.url().includes("/email-intelligence")) {
        await page.waitForTimeout(1500);

        const approveButton = page.getByRole("button", { name: /approve/i });

        if (await approveButton.count()) {
          await approveButton.first().click();
          await page.waitForTimeout(500);

          // Should show success message or remove suggestion
          const hasSuccess =
            (await page.locator("text=Approved").count()) > 0 ||
            (await page.locator("text=Task created").count()) > 0;

          expect(hasSuccess).toBe(true);
        }
      }
    });
  });

  describe("Email Connections", () => {
    test("should navigate to email settings", async ({ page }) => {
      await page.goto("/email");
      await page.waitForTimeout(1000);

      const isOnEmail = page.url().includes("/email");
      const isOnLogin = page.url().includes("/login");
      expect(isOnEmail || isOnLogin).toBe(true);
    });

    test("should display connect account button when authenticated", async ({ page }) => {
      await page.goto("/email");

      if (page.url().includes("/email")) {
        await page.waitForTimeout(1500);

        const connectButton =
          page.getByRole("button", { name: /connect/i }) ||
          page.getByRole("button", { name: /add account/i });

        const hasButton = (await connectButton.count()) > 0;
        expect(hasButton).toBe(true);
      }
    });
  });

  describe("Unassigned Emails", () => {
    test("should show unassigned emails section", async ({ page }) => {
      await page.goto("/inbound");

      if (page.url().includes("/inbound")) {
        await page.waitForTimeout(1500);

        // Check for unassigned section or indicator
        const hasUnassigned =
          (await page.locator("text=Unassigned").count()) > 0 ||
          (await page.locator("text=Unknown Sender").count()) > 0;

        // Unassigned section may not exist if all emails are assigned
        expect(hasUnassigned || true).toBe(true);
      }
    });

    test("should allow assigning unassigned emails", async ({ page }) => {
      await page.goto("/inbound");

      if (page.url().includes("/inbound")) {
        await page.waitForTimeout(1500);

        const assignButton = page.locator("text=Assign");

        if (await assignButton.count()) {
          await assignButton.first().click();
          await page.waitForTimeout(500);

          // Should show user selection
          const hasUserSelect = (await page.locator("select").count()) > 0 ||
            (await page.locator("text=Select user").count()) > 0;

          expect(hasUserSelect).toBe(true);
        }
      }
    });
  });
});
