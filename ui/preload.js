const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  // we can also expose variables, not just functions
  runProcess: (data) => ipcRenderer.invoke("run-process", data),
  getCurrentSelection: () => ipcRenderer.invoke("get-current-selection"),
  saveSelectionCsv: (data) => ipcRenderer.invoke("save-selection-config", data),
  saveSelectionConfig: (data) =>
    ipcRenderer.invoke("save-selection-config", data),
  getUiConfig: () => ipcRenderer.invoke("get-ui-config"),
});
