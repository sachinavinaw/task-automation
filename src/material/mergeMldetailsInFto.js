import ExcelJS from "exceljs";
import fs from "fs";
import dayjs from "dayjs";

import { ACTIVE_FTO_REPORT, DATA_OUTPUT_DIR } from "../../config/config.js";
import { logger } from "../../utils/logger.js";

const targetBlockName = ACTIVE_FTO_REPORT.BLOCK_NAME;
const targetFinancialYear = ACTIVE_FTO_REPORT.FINACIAL_YEAR;

const EXCEL_FILE = `${DATA_OUTPUT_DIR}/${targetBlockName}/${targetFinancialYear}/excel/MaterialList_FTO_Report.xlsx`;
const JSON_FILE = `${DATA_OUTPUT_DIR}/${targetBlockName}/${targetFinancialYear}/json/MaterialList_FTO_Report_With_Details.json`;

const config = {
  rowsToSkip: [2],
  columnsToSkip: [],
  columnWidths: {
    "Voucher No": 18,
    "Reference No": 34,
    Amount: 16,
  },
};

function normalizeFto(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

function cloneStyle(style) {
  return JSON.parse(JSON.stringify(style || {}));
}

function createLookup(jsonData) {
  const lookup = new Map();
  if (!Array.isArray(jsonData)) return lookup;

  for (const item of jsonData) {
    if (!item || !item.ftoNo) continue;

    const ml = item.materialListDetails || {};
    const details = Array.isArray(ml.details) ? ml.details : [];

    lookup.set(normalizeFto(item.ftoNo), {
      totalAmount: ml.totalAmount ?? "",
      details: details.map((d) => ({
        sNo: d.sNo ?? "",
        referenceNo: d.referenceNo ? String(d.referenceNo) : "",
        voucherNo: d.voucherNo ? String(d.voucherNo) : "",
        amount:
          d.amount !== undefined && d.amount !== null ? Number(d.amount) : "",
      })),
    });
  }

  return lookup;
}

function extractFtoNo(cellValue) {
  if (!cellValue) return "";
  if (typeof cellValue === "object" && cellValue.text) return cellValue.text;
  if (typeof cellValue === "object" && cellValue.hyperlink)
    return cellValue.text || "";
  return String(cellValue);
}

function shouldSkipRow(rowNumber) {
  if (rowNumber === 1) return false;
  return config.rowsToSkip.includes(rowNumber);
}

function copyCellStyle(sourceCell, targetCell, stripHyperlinkStyle = false) {
  targetCell.style = cloneStyle(sourceCell.style);
  if (sourceCell.font) targetCell.font = cloneStyle(sourceCell.font);
  if (sourceCell.fill) targetCell.fill = cloneStyle(sourceCell.fill);
  if (sourceCell.border) targetCell.border = cloneStyle(sourceCell.border);
  if (sourceCell.alignment)
    targetCell.alignment = cloneStyle(sourceCell.alignment);
  if (sourceCell.numFmt) targetCell.numFmt = sourceCell.numFmt;

  if (stripHyperlinkStyle) {
    targetCell.font = {
      ...(targetCell.font || {}),
      underline: false,
      color: { argb: "FF000000" },
    };
  }
}

async function mergeExcel() {
  const timestamp = dayjs().format("YYYYMMDD");
  const outputDir = `${DATA_OUTPUT_DIR}/${targetBlockName}/${targetFinancialYear}/finalFTO`;
  fs.mkdirSync(outputDir, { recursive: true });

  const outputFile = `${outputDir}/${timestamp}_MaterialList_FTO_Report_With_ML.xlsx`;

  const jsonData = JSON.parse(fs.readFileSync(JSON_FILE, "utf8"));
  const lookup = createLookup(jsonData);

  const sourceWorkbook = new ExcelJS.Workbook();
  await sourceWorkbook.xlsx.readFile(EXCEL_FILE);

  const sourceSheet = sourceWorkbook.worksheets[0];
  const targetWorkbook = new ExcelJS.Workbook();
  const targetSheet = targetWorkbook.addWorksheet(sourceSheet.name);

  // 1. Read Header Row & Locate FTO Column
  const headerRow = sourceSheet.getRow(1);
  const headerMap = [];
  let ftoColIndex = 4;

  headerRow.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    const colName = String(cell.value || "").trim();
    if (colName === "FTO No.") ftoColIndex = columnNumber;
    headerMap.push({ name: colName, index: columnNumber });
  });

  // 2. Build Output Column Structure
  const outputColumns = [];
  for (const header of headerMap) {
    if (!config.columnsToSkip.includes(header.name)) {
      outputColumns.push(header);
    }
  }
  outputColumns.push(
    { name: "Voucher No", inserted: true },
    { name: "Reference No", inserted: true },
    { name: "Amount", inserted: true },
  );

  // 3. Populate Rows
  let targetRowNumber = 1;

  sourceSheet.eachRow({ includeEmpty: true }, (sourceRow, sourceRowNumber) => {
    if (shouldSkipRow(sourceRowNumber)) return;

    // Header Row (Row 1)
    if (sourceRowNumber === 1) {
      const targetRow = targetSheet.getRow(targetRowNumber++);
      if (sourceRow.height) targetRow.height = sourceRow.height;

      let colIdx = 1;
      const headerStyleRefCell = sourceRow.getCell(1); // Non-hyperlink header cell

      for (const col of outputColumns) {
        const targetCell = targetRow.getCell(colIdx++);
        if (col.inserted) {
          targetCell.value = col.name;
          copyCellStyle(headerStyleRefCell, targetCell);
        } else {
          const srcCell = sourceRow.getCell(col.index);
          targetCell.value = srcCell.value;
          copyCellStyle(srcCell, targetCell);
        }
      }
      return;
    }

    // Data / Total Rows
    const ftoCell = sourceRow.getCell(ftoColIndex);
    const plainStyleRefCell = sourceRow.getCell(1); // Plain cell without hyperlink styling
    const ftoNo = extractFtoNo(ftoCell.value);
    const match = lookup.get(normalizeFto(ftoNo));
    const details = match?.details?.length ? match.details : [null];

    details.forEach((detailItem, detailIndex) => {
      const targetRow = targetSheet.getRow(targetRowNumber++);
      if (sourceRow.height && detailIndex === 0) {
        targetRow.height = sourceRow.height;
      }

      let colIdx = 1;
      for (const col of outputColumns) {
        const targetCell = targetRow.getCell(colIdx++);

        if (col.inserted) {
          // Copy plain cell style so no blue underline / hyperlink styling is inherited
          copyCellStyle(plainStyleRefCell, targetCell, true);

          if (col.name === "Voucher No") {
            targetCell.value = detailItem ? String(detailItem.voucherNo) : null;
          } else if (col.name === "Reference No") {
            targetCell.value = detailItem
              ? String(detailItem.referenceNo)
              : null;
          } else if (col.name === "Amount") {
            targetCell.value =
              detailItem && detailItem.amount !== ""
                ? Number(detailItem.amount)
                : null;
          }
        } else {
          const srcCell = sourceRow.getCell(col.index);
          targetCell.value = detailIndex === 0 ? srcCell.value : null;
          copyCellStyle(srcCell, targetCell);
        }
      }
    });
  });

  // 4. Set Column Widths
  let targetColIndex = 1;
  for (const col of outputColumns) {
    if (col.inserted) {
      targetSheet.getColumn(targetColIndex).width =
        config.columnWidths[col.name] || 20;
    } else {
      targetSheet.getColumn(targetColIndex).width = sourceSheet.getColumn(
        col.index,
      ).width;
    }
    targetColIndex++;
  }

  // 5. Freeze Header & Save
  targetSheet.views = [{ state: "frozen", ySplit: 1 }];

  await targetWorkbook.xlsx.writeFile(outputFile);
  logger.info(`File created: [${outputFile}]`);
}

mergeExcel().catch(console.error);
