import { test } from "@playwright/test";
import fs from "fs";

import { ACTIVE_FTO_REPORT } from "../../config/config.js";
import { logger } from "../../utils/logger.js";
const targetBlockName = ACTIVE_FTO_REPORT.BLOCK_NAME;
const targetFinancialYear = ACTIVE_FTO_REPORT.FINACIAL_YEAR;

test.only("[MATERIAL] Fetch Material List Details Name from FTO links", async ({
  page,
}) => {
  test.setTimeout(60 * 60 * 1000);

  const jsonDir = `${process.cwd()}/data/block/${targetBlockName}/${targetFinancialYear}/json`;
  fs.mkdirSync(jsonDir, {
    recursive: true,
  });

  const jsonFile = `${jsonDir}/MaterialList_FTO_Report.json`;
  const outputFile = `${jsonDir}/MaterialList_FTO_Report_With_Details.json`;

  const records = JSON.parse(fs.readFileSync(jsonFile, "utf8"));

  const CHUNK_SIZE = 10;
  const results = [];

  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE);

    logger.debug(`Processing records ${i + 1} to ${i + chunk.length}`);

    for (const record of chunk) {
      try {
        logger.debug(
          `Opening link for FTO No. [${record.ftoNo}]: ${record.hyperlink}`,
        );

        const urlMatch = String(record.hyperlink).match(
          /https:\/\/mnregaweb2\.dord\.gov\.in\/netnrega\/FTO\/[^"<>\s]+/,
        );

        const url = urlMatch?.[0];

        if (!url) {
          throw new Error(`Could not extract URL for ${record.ftoNo}`);
        }

        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 120000,
        });

        await page.waitForLoadState("networkidle");

        const data = await page.evaluate(() => {
          const tables = document.querySelectorAll("table");

          const targetTable = [...tables].find((table) =>
            table.innerText.includes("Voucher No."),
          );

          if (!targetTable) {
            return {
              materialListDetails: {
                totalAmount: 0,
                details: [],
              },
              error: "Target table not found",
            };
          }

          const rows = [...targetTable.querySelectorAll("tr")];

          let snoColIdx = -1;
          let refColIdx = -1;
          let voucherColIdx = -1;
          let amountColIdx = -1;
          let headerRowIdx = -1;

          // Find column headers precisely
          for (let i = 0; i < rows.length; i++) {
            const cells = [...rows[i].querySelectorAll("th, td")];

            cells.forEach((cell, idx) => {
              const text = cell.innerText.trim();

              if (snoColIdx === -1 && /^s\.?\s*no\.?$/i.test(text)) {
                snoColIdx = idx;
                headerRowIdx = i;
              }
              if (refColIdx === -1 && text.includes("Reference No.")) {
                refColIdx = idx;
              }
              if (voucherColIdx === -1 && text.includes("Voucher No.")) {
                voucherColIdx = idx;
              }
              if (
                amountColIdx === -1 &&
                text.includes("Amount to be credited")
              ) {
                amountColIdx = idx;
              }
            });

            if (
              snoColIdx !== -1 &&
              refColIdx !== -1 &&
              voucherColIdx !== -1 &&
              amountColIdx !== -1
            ) {
              break;
            }
          }

          if (refColIdx === -1 || voucherColIdx === -1) {
            return {
              materialListDetails: {
                totalAmount: 0,
                details: [],
              },
              error: "Required columns not found",
            };
          }

          const details = [];

          // Iterate through rows after header
          for (let i = headerRowIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            const cells = [...row.querySelectorAll("td, th")];
            const rowText = row.innerText;

            if (
              rowText.includes("SubTotal") ||
              rowText.includes("Total") ||
              !rowText.trim()
            ) {
              continue;
            }

            const refText = cells[refColIdx]
              ? cells[refColIdx].innerText.trim()
              : "";
            const voucherText = cells[voucherColIdx]
              ? cells[voucherColIdx].innerText.trim()
              : "";

            let amountVal = 0;
            if (amountColIdx !== -1 && cells[amountColIdx]) {
              const val = cells[amountColIdx].innerText
                .trim()
                .replace(/,/g, "");
              amountVal = parseFloat(val) || 0;
            }

            if (refText || voucherText) {
              details.push({
                sNo: details.length + 1,
                referenceNo: refText,
                voucherNo: voucherText,
                amount: amountVal,
              });
            }
          }

          // Calculate totalAmount accurately as the sum of all credited amounts
          const calculatedTotalAmount = details.reduce(
            (sum, item) => sum + item.amount,
            0,
          );

          return {
            materialListDetails: {
              totalEntries: details.length,
              totalAmount: Number(calculatedTotalAmount.toFixed(2)),
              details: details,
            },
          };
        });

        results.push({
          sno: results.length + 1,
          ftoNo: record.ftoNo,
          ftoLink: record.hyperlink,
          materialListDetails: data.materialListDetails,
        });
      } catch (error) {
        logger.error(`Failed: ${record.ftoNo}`, error);

        results.push({
          sno: results.length + 1,
          ftoNo: record.ftoNo,
          ftoLink: record.hyperlink,
          materialListDetails: {
            totalEntries: 0,
            totalAmount: 0,
            details: [],
          },
          error: error.message,
        });
      }
    }

    // Save progress after each chunk
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), "utf8");

    logger.info(`Saved progress: ${results.length}/${records.length}`);
  }

  logger.info(`Records fetched and exported to file: [${outputFile}]`);

  // delete the existing MaterialList_FTO_Report.json file after processing
  if (fs.existsSync(jsonFile)) {
    fs.unlinkSync(jsonFile);
    logger.info(`File deleted after processing: [${jsonFile}]`);
  }
});
