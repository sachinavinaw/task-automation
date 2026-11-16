/**
 * Initialize UI once DOM is fully loaded
 */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("automationForm");
  const blockNameSelect = document.getElementById("blockName");
  const fySelect = document.getElementById("financialYear");
  const taskGroup = document.getElementById("taskTypesGroup");
  const taskTypesError = document.getElementById("taskTypesError");
  const resetBtn = document.getElementById("resetBtn");
  const statusDiv = document.getElementById("status");
  const overlayLoader = document.getElementById("overlayLoader");

  let taskCheckboxes = [];

  const showLoader = () => overlayLoader.classList.add("active");
  const hideLoader = () => overlayLoader.classList.remove("active");

  const validateField = (field) => {
    if (field.value !== "") {
      field.classList.remove("is-invalid");
      field.classList.add("is-valid");
      return true;
    } else {
      field.classList.remove("is-valid");
      field.classList.add("is-invalid");
      return false;
    }
  };

  // Declare validateCheckboxes first using a standard function declaration
  function validateCheckboxes() {
    const isChecked = Array.from(taskCheckboxes).some((cb) => cb.checked);
    if (isChecked) {
      taskGroup.classList.remove("is-invalid");
      taskCheckboxes.forEach((cb) => cb.classList.remove("is-invalid"));
      taskTypesError.style.display = "none";
      return true;
    } else {
      taskGroup.classList.add("is-invalid");
      taskCheckboxes.forEach((cb) => cb.classList.add("is-invalid"));
      taskTypesError.style.display = "block";
      return false;
    }
  }

  try {
    // Load dropdown & task configuration from ui-data.json[cite: 5]
    const config = await window.electronAPI.getUiConfig();

    // Load saved values from .env.dev
    const savedSelection = await window.electronAPI.getCurrentSelection();

    // Populate dropdown options
    populateSelect(blockNameSelect, config.panchayats);
    populateSelect(fySelect, config.financialYears);

    // Dynamically render checkboxes from config.taskTypes[cite: 5]
    if (config.taskTypes) {
      config.taskTypes.forEach((task, index) => {
        const wrapper = document.createElement("div");
        wrapper.className = "form-check";

        const input = document.createElement("input");
        input.className = "form-check-input task-type-checkbox";
        input.type = "checkbox";
        input.value = task.key;
        input.id = task.key;

        // Restore checked state if saved in configuration
        if (
          savedSelection &&
          savedSelection.taskTypes &&
          savedSelection.taskTypes.includes(task.key)
        ) {
          input.checked = true;
        }

        const label = document.createElement("label");
        label.className = "form-check-label text-light";
        label.setAttribute("for", task.key);
        label.textContent = task.value;

        wrapper.appendChild(input);
        wrapper.appendChild(label);
        taskGroup.appendChild(wrapper);
      });

      // Re-query checkboxes after dynamic creation and attach event listener safely
      taskCheckboxes = document.querySelectorAll(".task-type-checkbox");
      taskCheckboxes.forEach((cb) => {
        cb.addEventListener("change", validateCheckboxes);
      });

      // Run initial validation check to clear error styles if tasks are pre-checked
      if (
        savedSelection &&
        savedSelection.taskTypes &&
        savedSelection.taskTypes.length > 0
      ) {
        validateCheckboxes();
      }
    }

    // Restore previously selected dropdown values
    if (savedSelection) {
      restoreSelection(
        blockNameSelect,
        savedSelection.blockName,
        config.panchayats,
      );
      restoreSelection(
        fySelect,
        savedSelection.financialYear,
        config.financialYears,
      );
    }
  } catch (error) {
    console.error("Initialization Error:", error);
    showStatus(
      `Failed to load configuration: ${error?.message || error}`,
      "danger",
    );
  }

  [blockNameSelect, fySelect].forEach((select) => {
    select.addEventListener("change", () => validateField(select));
  });

  resetBtn.addEventListener("click", () => {
    form.reset();
    [blockNameSelect, fySelect].forEach((select) => {
      select.classList.remove("is-valid", "is-invalid");
    });
    taskGroup.classList.remove("is-invalid");
    taskCheckboxes.forEach((cb) => cb.classList.remove("is-invalid"));
    taskTypesError.style.display = "none";
    statusDiv.textContent = "";
    hideLoader();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const isBlockValid = validateField(blockNameSelect);
    const isFyValid = validateField(fySelect);
    const isTaskTypesValid = validateCheckboxes();

    if (isBlockValid && isFyValid && isTaskTypesValid) {
      statusDiv.className = "text-success font-weight-bold";
      statusDiv.textContent = "Processing automation...";
      showLoader();

      const selectedTasks = Array.from(taskCheckboxes)
        .filter((cb) => cb.checked)
        .map((cb) => cb.value);

      try {
        const saveResult = await window.electronAPI.saveSelectionConfig({
          blockName: blockNameSelect.value,
          financialYear: fySelect.value,
          taskTypes: selectedTasks,
        });

        if (!saveResult.success) {
          throw new Error("Failed to save selection.");
        }

        const result = await window.electronAPI.runProcess();

        if (result.success) {
          showStatus(
            `<strong>✅ Automation Completed Successfully</strong><br><small>Exit Code: ${result.exitCode}</small>`,
            "success",
          );
        } else {
          showStatus(
            `<strong>❌ Automation Failed</strong><br>${escapeHtml(result.message)}`,
            "danger",
          );
        }
      } catch (error) {
        console.error(error);
        showStatus(
          `<strong>❌ Unexpected Error</strong><br>${escapeHtml(error.message || String(error))}`,
          "danger",
        );
      } finally {
        hideLoader();
      }
    } else {
      statusDiv.className = "text-danger";
      statusDiv.textContent = "Please fill out all required fields.";
    }
  });
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
 * Prevent HTML injection inside logs/errors
 */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
