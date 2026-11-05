import { test, expect } from "@playwright/test";
import dayjs from "dayjs";
import fs from "fs";
// import XLSX from "xlsx";
import XLSX from "xlsx-js-style";

import { ACTIVE_FTO_REPORT } from "../config/config.js";
import { logger } from "../utils/logger.js";

const targetBlockName = ACTIVE_FTO_REPORT.BLOCK_NAME;
const targetFinancialYear = ACTIVE_FTO_REPORT.FINACIAL_YEAR;

test("Download FTO Report for block", async ({ page }) => {
  test.setTimeout(180000); // 3 minutes

  // Open Bihar state page
  await page.goto(
    "https://mnregaweb2.dord.gov.in/netnrega/homestciti.aspx?state_code=05&state_name=BIHAR&lflag=eng&labels=labels",
    {
      waitUntil: "domcontentloaded",
    },
  );

  // Wait for home page
  await expect(
    page.locator("h3", { hasText: "State At a Glance" }),
  ).toBeVisible({
    timeout: 120000,
  });

  // Open district page
  await page
    .getByRole("link", {
      name: "PASHCHIM CHAMPARAN",
    })
    .click();

  // Wait for district page
  await expect(
    page.locator("th").filter({
      hasText: "DPC :PASHCHIM CHAMPARAN",
    }),
  ).toBeVisible({
    timeout: 120000,
  });

  // Change financial year
  await page.locator("#fin_year").selectOption(targetFinancialYear);

  // Give ASP.NET postback time to start
  await page.waitForTimeout(5000);

  // Wait for district header to appear again after refresh
  await expect(
    page.locator("th").filter({
      hasText: "DPC :PASHCHIM CHAMPARAN",
    }),
  ).toBeVisible({
    timeout: 120000,
  });

  // Wait for any link containing blockName text
  const blockNameLink = page.locator("a").filter({
    hasText: targetBlockName,
  });

  await expect(blockNameLink.first()).toBeVisible({
    timeout: 120000,
  });

  // Click blockName
  await blockNameLink.first().click();

  // Wait for next page
  await page.waitForLoadState("domcontentloaded");
  s;

  const ftoStatusReportLink = page.locator("a").filter({
    hasText: "FTO Status Report",
  });

  await ftoStatusReportLink.click();

  // Wait for the FTO table
  await expect(page.locator("text=FTO Generated at Block Level")).toBeVisible({
    timeout: 120000,
  });

  // Find row containing blockName
  const blockNameRow = page.locator("tr").filter({
    hasText: targetBlockName,
  });

  // 2nd Signatory -> No. of Signed FTO link
  const secondSignatorySignedFtoLink = blockNameRow
    .locator("td")
    .nth(5)
    .locator("a");

  await expect(secondSignatorySignedFtoLink).toBeVisible();

  const count = await secondSignatorySignedFtoLink.textContent();
  logger.info(`2nd Signatory Signed FTO Count:${count}`);

  await secondSignatorySignedFtoLink.click();

  await expect(page.locator("text=FTO Second Signatory")).toBeVisible({
    timeout: 120000,
  });

  const downloadsDir = `${process.cwd()}\\data\\block\\${targetBlockName}\\${targetFinancialYear}\\excel`;
  const fileName = `${downloadsDir}/FTO_Report.xlsx`;

  fs.mkdirSync(downloadsDir, { recursive: true });

  // Find the actual report table
  const reportTable = page
    .locator('table[style*="border-collapse: collapse"]')
    .last();

  const tableData = await reportTable.evaluate((table) => {
    return [...table.querySelectorAll("tr")].map((tr) =>
      [...tr.querySelectorAll("td, th")].map((cell) => {
        const link = cell.querySelector("a");

        return {
          text: cell.innerText.trim(),
          href: link ? link.href : null,
        };
      }),
    );
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = {};

  const rowCount = tableData.length;
  const colCount = Math.max(...tableData.map((r) => r.length));

  // Populate worksheet
  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < tableData[r].length; c++) {
      const cellData = tableData[r][c];

      const cellRef = XLSX.utils.encode_cell({
        r,
        c,
      });

      worksheet[cellRef] = {
        t: "s",
        v: cellData.text,
      };

      // Preserve hyperlinks
      if (cellData.href) {
        worksheet[cellRef].l = {
          Target: cellData.href,
        };
      }
    }
  }

  // Worksheet range
  worksheet["!ref"] = XLSX.utils.encode_range({
    s: {
      r: 0,
      c: 0,
    },
    e: {
      r: rowCount - 1,
      c: colCount - 1,
    },
  });

  // Auto width
  worksheet["!cols"] = Array.from({ length: colCount }, (_, colIndex) => {
    const maxLen = Math.max(
      ...tableData.map((row) => row[colIndex]?.text?.length || 0),
      10,
    );

    return {
      wch: Math.min(maxLen + 3, 60),
    };
  });

  // Style cells
  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      const ref = XLSX.utils.encode_cell({
        r,
        c,
      });

      if (!worksheet[ref]) continue;

      const hasLink = !!worksheet[ref].l;

      worksheet[ref].s = {
        font: {
          bold: r <= 1,
          color: hasLink ? { rgb: "0563C1" } : { rgb: "000000" },
          underline: hasLink,
        },

        fill:
          r <= 1
            ? {
                patternType: "solid",
                fgColor: {
                  rgb: "82B4FF",
                },
              }
            : undefined,

        alignment: {
          horizontal: "center",
          vertical: "center",
          wrapText: true,
        },

        border: {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        },
      };
    }
  }

  // Freeze top two rows
  worksheet["!freeze"] = {
    xSplit: 0,
    ySplit: 2,
  };

  // Add worksheet
  XLSX.utils.book_append_sheet(workbook, worksheet, "FTO Report");

  // Save file
  XLSX.writeFile(workbook, fileName);

  logger.info(`Saved block data oin file: [${fileName}]`);

  await page.pause();
});
