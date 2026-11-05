/**
 * Initialize UI once DOM is fully loaded
 */
document.addEventListener("DOMContentLoaded", async () => {
  const blockNameSelect = document.getElementById("blockName");
  const financialYearSelect = document.getElementById("financialYear");

  try {
    // Load dropdown configuration
    const config = await window.electronAPI.getUiConfig();

    // Load saved values from .env.dev
    const savedSelection = await window.electronAPI.getCurrentSelection();
    if (savedSelection) {
      console.log("Loading previous configurations");
    }

    /**
     * Populate dropdown options
     */
    populateSelect(blockNameSelect, config.panchayats);
    populateSelect(financialYearSelect, config.financialYears);

    /**
     * Restore previously selected values
     */
    restoreSelection(
      blockNameSelect,
      savedSelection.blockName,
      config.panchayats,
    );

    restoreSelection(
      financialYearSelect,
      savedSelection.financialYear,
      config.financialYears,
    );
  } catch (error) {
    console.error("Initialization Error:", error);
    console.error(error, "Initialization Error");
    showStatus(
      `Failed to load configuration: ${error?.message || error}`,
      "danger",
    );
  }
});

/**
 * Populate a select element
 */
function populateSelect(selectElement, items) {
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.replace(/-/g, "_");
    option.textContent = item;
    selectElement.appendChild(option);
  });
}

/**
 * Restore a saved dropdown selection
 */
function restoreSelection(selectElement, savedValue, validValues) {
  debugger;
  if (savedValue && validValues.includes(savedValue.replace(/_/g, "-"))) {
    selectElement.value = savedValue.replace(/-/g, "_");
    selectElement.classList.add("is-valid");
  }
}

/**
 * Display status alerts
 */
function showStatus(message, type = "info") {
  document.getElementById("status").innerHTML = `
    <div class="alert alert-${type}">
      ${message}
    </div>
  `;
}

/**
 * Helper to control the overlay loader visibility
 */
function toggleLoader(show) {
  const loader = document.getElementById("overlayLoader");
  if (loader) {
    if (show) {
      loader.classList.add("active");
    } else {
      loader.classList.remove("active");
    }
  }
}

/**
 * Start automation button
 */
document.getElementById("submitBtn").addEventListener("click", async () => {
  const blockName = document.getElementById("blockName").value;
  const financialYear = document.getElementById("financialYear").value;
  const submitBtn = document.getElementById("submitBtn");

  /**
   * Validate user selection
   */
  if (!blockName || !financialYear) {
    showStatus("Please select both Block Name and Financial Year.", "danger");
    return;
  }

  try {
    // Disable button and show full-page overlay loader
    submitBtn.disabled = true;
    toggleLoader(true);

    // Clear previous status messages
    document.getElementById("status").innerHTML = "";

    /**
     * Save selection to .env.dev
     */
    const saveResult = await window.electronAPI.saveSelectionConfig({
      blockName,
      financialYear,
    });

    if (!saveResult.success) {
      throw new Error("Failed to save selection.");
    }

    /**
     * Execute Playwright automation
     */
    const result = await window.electronAPI.runProcess();

    if (result.success) {
      showStatus(
        `
            <strong>✅ Automation Completed Successfully</strong>
            <br>
            <small>
              Exit Code:
              ${result.exitCode}
            </small>

            <details class="mt-2 text-start">
              <summary>
                View execution log
              </summary>

              <pre class="mt-2 p-2 bg-dark text-light rounded">
${escapeHtml(result.stdout || "No Output")}
              </pre>
            </details>
            `,
        "success",
      );
    } else {
      showStatus(
        `
            <strong>❌ Automation Failed</strong>
            <br>
            ${escapeHtml(result.message)}
            `,
        "danger",
      );
    }
  } catch (error) {
    console.error(error);
    showStatus(
      `
          <strong>❌ Unexpected Error</strong>
          <br>
          ${escapeHtml(error.message || String(error))}
          `,
      "danger",
    );
  } finally {
    // Re-enable button and hide full-page overlay loader
    submitBtn.disabled = false;
    toggleLoader(false);
  }
});

/**
 * Prevent HTML injection inside logs/errors
 */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
