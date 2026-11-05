import ExcelJS from "exceljs";
import fs from "fs";
import dayjs from "dayjs";

import { ACTIVE_FTO_REPORT } from "../config/config.js";
const targetBlockName = ACTIVE_FTO_REPORT.BLOCK_NAME;
const targetFinancialYear = ACTIVE_FTO_REPORT.FINACIAL_YEAR;

const EXCEL_FILE = `${process.cwd()}/data/block/${targetBlockName}/${targetFinancialYear}/excel/FTO_Report.xlsx`;

const JSON_FILE = `${process.cwd()}/data/block/${targetBlockName}/${targetFinancialYear}/json/FTO_Report_With_Panchayat.json`;

const config = {
  // Row 1 = Header
  // Row 2 = 1,2,3,4...
  rowsToSkip: [2],

  columnsToSkip: [
    "Financial Institution",
    "No of Transaction",
    "No of Transaction Processed",
    "No of Transaction Rejected",
    "No of Invalid Account",
  ],

  blockColumnWidth: 20,
  panchayatColumnWidth: 35,
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

  for (const item of jsonData) {
    lookup.set(normalizeFto(item.ftoNo), {
      blockName: item.blockName || "",
      panchayatName: Array.isArray(item.allPanchayats)
        ? item.allPanchayats.join(", ")
        : "",
    });
  }

  return lookup;
}

function extractFtoNo(cellValue) {
  if (!cellValue) return "";

  if (typeof cellValue === "object" && cellValue.text) {
    return cellValue.text;
  }

  if (typeof cellValue === "object" && cellValue.hyperlink) {
    return cellValue.text || "";
  }

  return String(cellValue);
}

function shouldSkipRow(rowNumber) {
  if (rowNumber === 1) {
    return false;
  }

  return config.rowsToSkip.includes(rowNumber);
}

async function mergeExcel() {
  const timestamp = dayjs().format("YYYYMMDD");

  const outputDir = `${process.cwd()}/data/block/${targetBlockName}/${targetFinancialYear}/finalFTO`;

  fs.mkdirSync(outputDir, {
    recursive: true,
  });

  const outputFile = `${outputDir}/${timestamp}_FTO_Report_With_Panchayat.xlsx`;

  const jsonData = JSON.parse(fs.readFileSync(JSON_FILE, "utf8"));

  const lookup = createLookup(jsonData);

  const sourceWorkbook = new ExcelJS.Workbook();

  await sourceWorkbook.xlsx.readFile(EXCEL_FILE);

  const sourceSheet = sourceWorkbook.worksheets[0];

  const targetWorkbook = new ExcelJS.Workbook();

  const targetSheet = targetWorkbook.addWorksheet(sourceSheet.name);

  //------------------------------------------
  // Read Header Row
  //------------------------------------------

  const headerRow = sourceSheet.getRow(1);

  const headerMap = [];

  headerRow.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    headerMap.push({
      name: String(cell.value || "").trim(),
      index: columnNumber,
    });
  });

  //------------------------------------------
  // Build Output Structure
  //------------------------------------------

  const outputColumns = [];

  for (const header of headerMap) {
    if (config.columnsToSkip.includes(header.name)) {
      continue;
    }

    outputColumns.push(header);

    if (header.name === "FTO No.") {
      outputColumns.push({
        name: "Block Name",
        inserted: true,
      });

      outputColumns.push({
        name: "Panchayat Name",
        inserted: true,
      });
    }
  }

  //------------------------------------------
  // Copy All Rows
  //------------------------------------------

  let targetRowNumber = 1;

  sourceSheet.eachRow({ includeEmpty: true }, (sourceRow, sourceRowNumber) => {
    if (shouldSkipRow(sourceRowNumber)) {
      return;
    }

    const targetRow = targetSheet.getRow(targetRowNumber++);

    let targetColumnNumber = 1;

    for (const column of outputColumns) {
      //----------------------------------
      // Inserted Columns
      //----------------------------------

      if (column.inserted) {
        const targetCell = targetRow.getCell(targetColumnNumber++);

        //--------------------------------
        // Header Row
        //--------------------------------

        if (sourceRowNumber === 1) {
          targetCell.value = column.name;

          const styleRef = sourceRow.getCell(4);

          targetCell.style = cloneStyle(styleRef.style);

          continue;
        }

        //--------------------------------
        // Data Rows
        //--------------------------------

        const ftoCell = sourceRow.getCell(4);

        const ftoNo = extractFtoNo(ftoCell.value);

        const match = lookup.get(normalizeFto(ftoNo));

        targetCell.value =
          column.name === "Block Name"
            ? match?.blockName || ""
            : match?.panchayatName || "";

        targetCell.style = cloneStyle(ftoCell.style);

        continue;
      }

      //----------------------------------
      // Existing Columns
      //----------------------------------

      const sourceCell = sourceRow.getCell(column.index);

      const targetCell = targetRow.getCell(targetColumnNumber++);

      //----------------------------------
      // Preserve Value
      //----------------------------------

      targetCell.value = sourceCell.value;

      //----------------------------------
      // Preserve Styles
      //----------------------------------

      targetCell.style = cloneStyle(sourceCell.style);

      if (sourceCell.font) {
        targetCell.font = cloneStyle(sourceCell.font);
      }

      if (sourceCell.fill) {
        targetCell.fill = cloneStyle(sourceCell.fill);
      }

      if (sourceCell.border) {
        targetCell.border = cloneStyle(sourceCell.border);
      }

      if (sourceCell.alignment) {
        targetCell.alignment = cloneStyle(sourceCell.alignment);
      }

      if (sourceCell.numFmt) {
        targetCell.numFmt = sourceCell.numFmt;
      }

      if (sourceCell.note) {
        targetCell.note = sourceCell.note;
      }
    }
  });

  //------------------------------------------
  // Column Widths
  //------------------------------------------

  let targetColIndex = 1;

  for (const column of outputColumns) {
    if (column.inserted) {
      targetSheet.getColumn(targetColIndex).width =
        column.name === "Block Name"
          ? config.blockColumnWidth
          : config.panchayatColumnWidth;

      targetColIndex++;
      continue;
    }

    const width = sourceSheet.getColumn(column.index).width;

    targetSheet.getColumn(targetColIndex).width = width;

    targetColIndex++;
  }

  //------------------------------------------
  // Row Heights
  //------------------------------------------

  let targetHeightRow = 1;

  sourceSheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (shouldSkipRow(rowNumber)) {
      return;
    }

    if (row.height) {
      targetSheet.getRow(targetHeightRow).height = row.height;
    }

    targetHeightRow++;
  });

  //------------------------------------------
  // Freeze Header
  //------------------------------------------

  targetSheet.views = [
    {
      state: "frozen",
      ySplit: 1,
    },
  ];

  //------------------------------------------
  // Save
  //------------------------------------------

  await targetWorkbook.xlsx.writeFile(outputFile);

  console.log(`Created: ${outputFile}`);
}

mergeExcel().catch(console.error);
