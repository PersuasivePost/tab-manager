// Tab Collections Manager - Main Logic

class TabCollectionsManager {
  constructor() {
    this.collections = [];
    this.init();
  }

  async init() {
    await this.loadCollections();
    this.renderCollections();
    this.bindEvents();
  }

  // Load collections from storage
  async loadCollections() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["tabCollections"], (result) => {
        this.collections = result.tabCollections || [];
        resolve();
      });
    });
  }

  // Save collections to storage
  async saveToStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ tabCollections: this.collections }, resolve);
    });
  }

  // Bind all event listeners
  bindEvents() {
    // Save button
    document
      .getElementById("saveBtn")
      .addEventListener("click", () => this.saveCurrentWindow());

    // Enter key on input
    document
      .getElementById("collectionName")
      .addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.saveCurrentWindow();
      });

    // Export button
    document
      .getElementById("exportBtn")
      .addEventListener("click", () => this.exportCollections());

    // Import button
    document.getElementById("importBtn").addEventListener("click", () => {
      document.getElementById("importFile").click();
    });

    // Import file change
    document
      .getElementById("importFile")
      .addEventListener("change", (e) => this.importCollections(e));
  }

  // Save current window's tabs as a collection
  async saveCurrentWindow() {
    const nameInput = document.getElementById("collectionName");
    const name = nameInput.value.trim();

    if (!name) {
      this.showToast("Please enter a collection name", "error");
      nameInput.focus();
      return;
    }

    // Check for duplicate names
    if (
      this.collections.some((c) => c.name.toLowerCase() === name.toLowerCase())
    ) {
      this.showToast("Collection with this name already exists", "error");
      return;
    }

    try {
      // Get current window's tabs
      const tabs = await chrome.tabs.query({ currentWindow: true });

      const collection = {
        id: Date.now().toString(),
        name: name,
        createdAt: new Date().toISOString(),
        tabs: tabs.map((tab) => ({
          url: tab.url,
          title: tab.title,
          favIconUrl: tab.favIconUrl || "",
        })),
      };

      this.collections.unshift(collection);
      await this.saveToStorage();
      this.renderCollections();

      nameInput.value = "";
      this.showToast(`Saved "${name}" with ${tabs.length} tabs!`, "success");

      // Close window if checkbox is checked
      const closeAfterSave = document.getElementById("closeAfterSave").checked;
      if (closeAfterSave) {
        const currentWindow = await chrome.windows.getCurrent();
        // Open a new window first to prevent browser from closing completely
        chrome.windows.create({}, () => {
          chrome.windows.remove(currentWindow.id);
        });
      }
    } catch (error) {
      console.error("Error saving collection:", error);
      this.showToast("Error saving collection", "error");
    }
  }

  // Open all tabs from a collection
  async openCollection(collectionId) {
    const collection = this.collections.find((c) => c.id === collectionId);
    if (!collection) return;

    try {
      // Create a new window with the first tab
      const urls = collection.tabs.map((t) => t.url);

      chrome.windows.create({ url: urls }, () => {
        this.showToast(`Opened "${collection.name}"!`, "success");
      });
    } catch (error) {
      console.error("Error opening collection:", error);
      this.showToast("Error opening collection", "error");
    }
  }

  // Delete a collection
  async deleteCollection(collectionId) {
    const collection = this.collections.find((c) => c.id === collectionId);
    if (!collection) return;

    if (confirm(`Delete "${collection.name}"? This cannot be undone.`)) {
      this.collections = this.collections.filter((c) => c.id !== collectionId);
      await this.saveToStorage();
      this.renderCollections();
      this.showToast("Collection deleted", "success");
    }
  }

  // Update a collection with current window tabs
  async updateCollection(collectionId) {
    const collection = this.collections.find((c) => c.id === collectionId);
    if (!collection) return;

    if (confirm(`Update "${collection.name}" with current window's tabs?`)) {
      try {
        const tabs = await chrome.tabs.query({ currentWindow: true });

        collection.tabs = tabs.map((tab) => ({
          url: tab.url,
          title: tab.title,
          favIconUrl: tab.favIconUrl || "",
        }));
        collection.updatedAt = new Date().toISOString();

        await this.saveToStorage();
        this.renderCollections();
        this.showToast(`Updated "${collection.name}"!`, "success");
      } catch (error) {
        console.error("Error updating collection:", error);
        this.showToast("Error updating collection", "error");
      }
    }
  }

  // Render collections list
  renderCollections() {
    const container = document.getElementById("collectionsList");
    const countBadge = document.getElementById("collectionCount");

    countBadge.textContent = this.collections.length;

    if (this.collections.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"/>
              <path d="M3 9H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"/>
            </svg>
          </div>
          <h3>No collections yet</h3>
          <p>Save your current window to get started</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.collections
      .map((collection) => this.createCollectionCard(collection))
      .join("");

    // Bind card events
    this.bindCardEvents();
    this.bindDragAndDrop();
  }

  // Bind drag and drop events
  bindDragAndDrop() {
    const cards = document.querySelectorAll(".collection-card");
    let draggedElement = null;
    let draggedIndex = null;

    cards.forEach((card, index) => {
      // Drag start
      card.addEventListener("dragstart", (e) => {
        draggedElement = card;
        draggedIndex = index;
        card.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/html", card.innerHTML);
      });

      // Drag end
      card.addEventListener("dragend", (e) => {
        card.classList.remove("dragging");
        document.querySelectorAll(".collection-card").forEach((c) => {
          c.classList.remove("drag-over");
        });
      });

      // Drag over
      card.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";

        if (draggedElement !== card) {
          card.classList.add("drag-over");
        }
      });

      // Drag leave
      card.addEventListener("dragleave", (e) => {
        card.classList.remove("drag-over");
      });

      // Drop
      card.addEventListener("drop", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        card.classList.remove("drag-over");

        if (draggedElement !== card) {
          const targetId = card.dataset.id;
          const draggedId = draggedElement.dataset.id;

          // Find indices in collections array
          const draggedIdx = this.collections.findIndex(
            (c) => c.id === draggedId,
          );
          const targetIdx = this.collections.findIndex(
            (c) => c.id === targetId,
          );

          // Reorder collections array
          const [removed] = this.collections.splice(draggedIdx, 1);
          this.collections.splice(targetIdx, 0, removed);

          // Save and re-render
          await this.saveToStorage();
          this.renderCollections();
          this.showToast("Collection order updated", "success");
        }
      });
    });
  }

  // Create collection card HTML
  createCollectionCard(collection) {
    const date = new Date(collection.createdAt);
    const formattedDate = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year:
        date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });

    const previewTabs = collection.tabs.slice(0, 4);
    const remainingCount = collection.tabs.length - 4;

    const fallbackIcon =
      "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌐</text></svg>";

    const tabPreviewHTML = previewTabs
      .map(
        (tab) => `
      <div class="tab-preview-item" title="${this.escapeHtml(tab.title)}">
        <img src="${tab.favIconUrl || fallbackIcon}" 
             data-fallback="${fallbackIcon}"
             class="tab-favicon">
        ${this.escapeHtml(this.truncate(tab.title, 18))}
      </div>
    `,
      )
      .join("");

    return `
      <div class="collection-card" data-id="${collection.id}" draggable="true">
        <div class="collection-header">
          <div class="drag-handle" title="Drag to reorder">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="9" cy="5" r="1.5" fill="currentColor"/>
              <circle cx="15" cy="5" r="1.5" fill="currentColor"/>
              <circle cx="9" cy="12" r="1.5" fill="currentColor"/>
              <circle cx="15" cy="12" r="1.5" fill="currentColor"/>
              <circle cx="9" cy="19" r="1.5" fill="currentColor"/>
              <circle cx="15" cy="19" r="1.5" fill="currentColor"/>
            </svg>
          </div>
          <div class="collection-info">
            <h3>${this.escapeHtml(collection.name)}</h3>
            <div class="collection-meta">
              <div class="collection-meta-item">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 12H15M9 16H15M17 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3H12.5858C12.851 3 13.1054 3.10536 13.2929 3.29289L18.7071 8.70711C18.8946 8.89464 19 9.149 19 9.41421V19C19 20.1046 18.1046 21 17 21Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                ${collection.tabs.length} tabs
              </div>
              <div class="collection-meta-item">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 7V3M16 7V3M7 11H17M5 21H19C20.1046 21 21 20.1046 21 19V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V19C3 20.1046 3.89543 21 5 21Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                ${formattedDate}
              </div>
            </div>
          </div>
        </div>
        
        <div class="tab-preview">
          ${tabPreviewHTML}
          ${remainingCount > 0 ? `<div class="tab-preview-item more-tabs-badge">+${remainingCount} more</div>` : ""}
        </div>
        
        <div class="collection-actions">
          <button class="btn btn-success btn-small open-btn" data-id="${collection.id}">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13 17L18 12L13 7M6 17L11 12L6 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Open
          </button>
          <button class="btn btn-secondary btn-small update-btn" data-id="${collection.id}">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 12V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V12M16 6L12 2L8 6M12 2V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Update
          </button>
          <button class="btn btn-danger btn-small delete-btn" data-id="${collection.id}">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 6H5H21M19 6V20C19 21.1046 18.1046 22 17 22H7C5.89543 22 5 21.1046 5 20V6M8 6V4C8 2.89543 8.89543 2 10 2H14C15.1046 2 16 2.89543 16 4V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Delete
          </button>
        </div>
      </div>
    `;
  }

  // Bind events to collection cards
  bindCardEvents() {
    // Open buttons
    document.querySelectorAll(".open-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.target.closest(".open-btn").dataset.id;
        this.openCollection(id);
      });
    });

    // Update buttons
    document.querySelectorAll(".update-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.target.closest(".update-btn").dataset.id;
        this.updateCollection(id);
      });
    });

    // Delete buttons
    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.target.closest(".delete-btn").dataset.id;
        this.deleteCollection(id);
      });
    });

    // Favicon error handling
    document.querySelectorAll(".tab-favicon").forEach((img) => {
      img.addEventListener("error", (e) => {
        e.target.src = e.target.dataset.fallback;
      });
    });
  }

  // Export collections to JSON file
  exportCollections() {
    if (this.collections.length === 0) {
      this.showToast("No collections to export", "error");
      return;
    }

    const data = JSON.stringify(this.collections, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `tab-collections-${new Date().toISOString().split("T")[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
    this.showToast("Collections exported!", "success");
  }

  // Import collections from JSON file
  importCollections(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target.result);

        if (!Array.isArray(imported)) {
          throw new Error("Invalid format");
        }

        // Merge with existing, avoiding duplicates by name
        let addedCount = 0;
        imported.forEach((collection) => {
          if (
            collection.name &&
            collection.tabs &&
            Array.isArray(collection.tabs)
          ) {
            if (
              !this.collections.some(
                (c) => c.name.toLowerCase() === collection.name.toLowerCase(),
              )
            ) {
              this.collections.push({
                ...collection,
                id:
                  Date.now().toString() +
                  Math.random().toString(36).substr(2, 9),
              });
              addedCount++;
            }
          }
        });

        await this.saveToStorage();
        this.renderCollections();
        this.showToast(`Imported ${addedCount} collections!`, "success");
      } catch (error) {
        console.error("Import error:", error);
        this.showToast("Invalid import file", "error");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  // Show toast notification
  showToast(message, type = "info") {
    const toast = document.getElementById("toast");
    const toastMessage = toast.querySelector(".toast-message");

    toastMessage.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  }

  // Utility: Escape HTML
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
  }

  // Utility: Truncate text
  truncate(text, length) {
    if (!text) return "";
    return text.length > length ? text.substring(0, length) + "..." : text;
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new TabCollectionsManager();
});
