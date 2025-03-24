document.addEventListener("DOMContentLoaded", async () => {
  const extractBtn = document.getElementById("extractBtn");
  const eventForm = document.getElementById("eventForm");
  const loadingMessage = document.getElementById("loadingMessage");
  const errorMessage = document.getElementById("errorMessage");
  const autoExtractToggle = document.getElementById("autoExtractToggle");

  const ENDPOINT_URL =
    "https://67e13a6b58cc6bf78524e238.mockapi.io/api/v1/Event";

  // Load saved toggle state
  const { autoExtract = false } = await chrome.storage.sync.get("autoExtract");
  autoExtractToggle.checked = autoExtract;

  // Toggle state change handler
  autoExtractToggle.addEventListener("change", () => {
    chrome.storage.sync.set({ autoExtract: autoExtractToggle.checked });
  });

  // Auto-extract if toggle is enabled
  if (autoExtractToggle.checked) {
    extractEventData();
  }

  // Extract button click handler
  extractBtn.addEventListener("click", extractEventData);

  // Main function to extract event data
  async function extractEventData() {
    try {
      // Show loading state
      loadingMessage.style.display = "block";
      errorMessage.style.display = "none";
      eventForm.style.display = "none";

      // Get active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      // Get HTML content from active tab
      const [{ result: htmlContent }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => document.documentElement.outerHTML,
      });

      // Send HTML to endpoint
      const response = await fetch(ENDPOINT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rawHtml: htmlContent.substr(0, 200),
          url: tab.url,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const eventData = await response.json();

      // Check if event data was found
      if (!eventData || !eventData.id) {
        // No event data found - show empty form for manual entry
        showEmptyForm();

        // Hide loading, show warning
        loadingMessage.style.display = "none";
        errorMessage.textContent =
          "No event data found. You can add it manually.";
        errorMessage.style.backgroundColor = "#fff3e0";
        errorMessage.style.color = "#e65100";
        errorMessage.style.display = "block";
        return;
      }

      // Populate form with response data
      populateForm(eventData);

      // Hide loading, show form
      loadingMessage.style.display = "none";
      eventForm.style.display = "block";
    } catch (error) {
      // Handle errors
      loadingMessage.style.display = "none";
      errorMessage.textContent = `Error: ${error.message}`;
      errorMessage.style.backgroundColor = "#ffebee";
      errorMessage.style.color = "#c62828";
      errorMessage.style.display = "block";
      console.error("Extraction error:", error);

      // Show empty form for manual entry on error
      showEmptyForm();
    }
  }

  // Show empty form for manual data entry
  function showEmptyForm() {
    // Clear any previous values
    resetForm();
    // Show the form
    eventForm.style.display = "block";
  }

  // Reset form to empty values
  function resetForm() {
    document.getElementById("title").value = "";
    document.getElementById("provider").value = "";
    document.getElementById("summary").value = "";
    document.getElementById("priceAmount").value = "";
    document.getElementById("activeTimeRangeLower").value = "";
    document.getElementById("activeTimeRangeUpper").value = "";
    document.getElementById("description").value = "";
    document.getElementById("id").value = "";
  }

  // Form submit handler
  eventForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      // Show loading state
      loadingMessage.style.display = "block";
      errorMessage.style.display = "none";

      // Collect form data
      const formData = {
        title: document.getElementById("title").value,
        provider: document.getElementById("provider").value,
        summary: document.getElementById("summary").value,
        priceAmount: Number(document.getElementById("priceAmount").value),
        activeTimeRangeLower: dateToUnixTimestamp(
          document.getElementById("activeTimeRangeLower").value
        ),
        activeTimeRangeUpper: dateToUnixTimestamp(
          document.getElementById("activeTimeRangeUpper").value
        ),
        description: document.getElementById("description").value,
      };

      // Send updated data to endpoint
      const response = await fetch(ENDPOINT_URL, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const updatedData = await response.json();

      // Update form with response
      populateForm(updatedData);

      // Hide loading
      loadingMessage.style.display = "none";

      // Show success message
      errorMessage.textContent = "Event updated successfully!";
      errorMessage.style.backgroundColor = "#e8f5e9";
      errorMessage.style.color = "#2e7d32";
      errorMessage.style.display = "block";
    } catch (error) {
      // Handle errors
      loadingMessage.style.display = "none";
      errorMessage.style.backgroundColor = "#ffebee";
      errorMessage.style.color = "#c62828";
      errorMessage.textContent = `Error: ${error.message}`;
      errorMessage.style.display = "block";
      console.error("Update error:", error);
    }
  });

  // Function to populate form with event data
  function populateForm(eventData) {
    document.getElementById("title").value = eventData.title || "";
    document.getElementById("provider").value = eventData.provider || "";
    document.getElementById("summary").value = eventData.summary || "";
    document.getElementById("priceAmount").value = eventData.priceAmount || "";

    // Convert Unix timestamps to datetime-local format
    if (eventData.activeTimeRangeLower) {
      document.getElementById("activeTimeRangeLower").value =
        unixTimestampToDatetimeLocal(eventData.activeTimeRangeLower);
    }

    if (eventData.activeTimeRangeUpper) {
      document.getElementById("activeTimeRangeUpper").value =
        unixTimestampToDatetimeLocal(eventData.activeTimeRangeUpper);
    }

    document.getElementById("description").value = eventData.description || "";
    document.getElementById("id").value = eventData.id || "";
  }

  function unixTimestampToDatetimeLocal(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toISOString().slice(0, 16);
  }

  function dateToUnixTimestamp(datetimeLocal) {
    if (!datetimeLocal) return null;
    return Math.floor(new Date(datetimeLocal).getTime() / 1000);
  }
});
