console.log("electronAPI =", window.electronAPI);

document.addEventListener("DOMContentLoaded", async () => {
  const config = await window.electronAPI.getUiConfig();

  const panchayatSelect = document.getElementById("panchayat");

  const fySelect = document.getElementById("financialYear");

  config.panchayats.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.replace(/-/g, "_");
    option.textContent = item;

    panchayatSelect.appendChild(option);
  });

  config.financialYears.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.replace(/-/g, "_");
    option.textContent = item;

    fySelect.appendChild(option);
  });
});

const submitBtn = document.getElementById("submitBtn");
submitBtn.addEventListener("click", async () => {
  const panchayat = document.getElementById("panchayat").value;
  const financialYear = document.getElementById("financialYear").value;

  const status = document.getElementById("status");

  if (!panchayat || !financialYear) {
    status.innerHTML =
      '<div class="alert alert-danger">Please select both values.</div>';
    return;
  }

  status.innerHTML = '<div class="alert alert-info">Processing...</div>';

  try {
    // Save CSV entry
    await window.electronAPI.saveSelectionCsv({
      panchayat,
      financialYear,
    });

    // Execute your existing process
    const result = await window.electronAPI.runProcess({
      panchayat,
      financialYear,
    });

    status.innerHTML = `<div class="alert alert-success">${result}</div>`;
  } catch (err) {
    status.innerHTML = `<div class="alert alert-danger">${err}</div>`;
  }
});
