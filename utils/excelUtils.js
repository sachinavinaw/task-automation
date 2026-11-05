import XLSX from "xlsx-js-style";
import fs from "fs";
import { logger } from "./logger.js";

export function writeXlsx(filePath, data, formatting = {}) {
  const workbook = XLSX.utils.book_new();

  const worksheet = XLSX.utils.aoa_to_sheet([data.headers, ...data.rows]);

  const range = XLSX.utils.decode_range(worksheet["!ref"]);

  const defaultBorder = {
    top: {
      style: formatting.border?.style || "thin",
      color: { rgb: formatting.border?.color || "000000" },
    },
    bottom: {
      style: formatting.border?.style || "thin",
      color: { rgb: formatting.border?.color || "000000" },
    },
    left: {
      style: formatting.border?.style || "thin",
      color: { rgb: formatting.border?.color || "000000" },
    },
    right: {
      style: formatting.border?.style || "thin",
      color: { rgb: formatting.border?.color || "000000" },
    },
  };

  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });

      if (!worksheet[cellRef]) continue;

      const isHeader = r === 0;

      const style = isHeader
        ? {
            font: formatting.header?.font && {
              ...formatting.header.font,
              color: formatting.header.font.color
                ? { rgb: formatting.header.font.color }
                : undefined,
            },
            fill: formatting.header?.fill && {
              patternType: "solid",
              fgColor: {
                rgb: formatting.header.fill.color,
              },
            },
            alignment: formatting.header?.alignment,
            border: defaultBorder,
          }
        : {
            font: formatting.cell?.font,
            fill: formatting.cell?.fill && {
              patternType: "solid",
              fgColor: {
                rgb: formatting.cell.fill.color,
              },
            },
            alignment: formatting.cell?.alignment,
            border: defaultBorder,
          };

      worksheet[cellRef].s = style;
    }
  }

  // Column formats
  if (formatting.columns) {
    Object.entries(formatting.columns).forEach(([column, config]) => {
      for (let row = 2; row <= range.e.r + 1; row++) {
        const ref = `${column}${row}`;

        if (worksheet[ref] && config.numFmt) {
          worksheet[ref].z = config.numFmt;
        }
      }
    });
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  XLSX.writeFile(workbook, filePath);
}

/**
 * Read FTO Excel and return JSON records.
 *
 * Output:
 * [
 *   {
 *     sno: 1,
 *     ftoNo: "BH0512016_010425APB_FTO_1193",
 *     hyperlink: "https://...."
 *   }
 * ]
 */
export function readFtoExcel(filePath) {
  const workbook = XLSX.readFile(filePath);

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const range = XLSX.utils.decode_range(worksheet["!ref"]);

  const records = [];
  const dataRowIndex = 2;

  // Skip Header Row
  for (let row = dataRowIndex; row <= range.e.r; row++) {
    const snoCell =
      worksheet[
        XLSX.utils.encode_cell({
          r: row,
          c: 0,
        })
      ];

    const ftoCell =
      worksheet[
        XLSX.utils.encode_cell({
          r: row,
          c: 3,
        })
      ];

    if (!ftoCell?.v) {
      continue;
    }

    records.push({
      sno: Number(snoCell?.v || row),
      ftoNo: String(ftoCell.v).trim(),
      hyperlink: ftoCell?.l?.Target || null,
    });
  }

  return records;
}

/**
 * Split records into chunks.
 */
export function chunkRecords(records, chunkSize = 10) {
  const chunks = [];

  for (let i = 0; i < records.length; i += chunkSize) {
    chunks.push(records.slice(i, i + chunkSize));
  }

  return chunks;
}

/**
 * Save JSON to file.
 */
export function saveJsonToFile(data, outputFile) {
  fs.writeFileSync(outputFile, JSON.stringify(data, null, 2), "utf8");

  logger.info(`JSON saved to file: [${outputFile}]`);
}
