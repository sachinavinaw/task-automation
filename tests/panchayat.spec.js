import { test } from "@playwright/test";
import fs from "fs";

import { ACTIVE_FTO_REPORT } from "../config/config.js";

const targetBlockName = ACTIVE_FTO_REPORT.BLOCK_NAME;
const targetFinancialYear = ACTIVE_FTO_REPORT.FINACIAL_YEAR;

test.only("Fetch Panchayat Name from FTO links", async ({ page }) => {
  test.setTimeout(60 * 60 * 1000);

  const jsonDir = `${process.cwd()}/data/block/${targetBlockName}/${targetFinancialYear}/json`;
  fs.mkdirSync(jsonDir, {
    recursive: true,
  });

  const jsonFile = `${jsonDir}/FTO_Report.json`;

  const outputFile = `${jsonDir}/FTO_Report_With_Panchayat.json`;

  const records = JSON.parse(fs.readFileSync(jsonFile, "utf8"));

  const CHUNK_SIZE = 10;

  const results = [];

  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE);

    console.log(`Processing records ${i + 1} to ${i + chunk.length}`);

    for (const record of chunk) {
      try {
        console.log(`Opening: ${record.ftoNo}`);

        const urlMatch = String(record.hyperlink).match(
          /https:\/\/mnregaweb2\.dord\.gov\.in\/netnrega\/FTO\/[^"<>\s]+/,
        );

        const url = urlMatch?.[0];

        if (!url) {
          throw new Error(`Could not extract URL for ${record.ftoNo}`);
        }

        console.log("Opening URL:", url);

        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 120000,
        });

        const title = await page.title();
        console.log("Title:", title);

        console.log("Tables:", await page.locator("table").count());

        await page.waitForLoadState("networkidle");

        const data = await page.evaluate(() => {
          const tables = document.querySelectorAll("table");

          // const targetTable = tables[3];
          const targetTable = [...tables].find((table) =>
            table.innerText.includes("Job Card No."),
          );

          if (!targetTable) {
            return {
              allPanchayats: [],
              error: "4th table not found",
            };
          }

          const rows = [...targetTable.querySelectorAll("tr")];

          let jobCardColumnIndex = -1;
          let headerRowIndex = -1;
          let blockColumnIndex = -1;

          // Find Job Card column
          for (let i = 0; i < rows.length; i++) {
            const cells = [...rows[i].querySelectorAll("th, td")];

            // const idx = cells.findIndex((cell) =>
            //   cell.innerText.trim().includes("Job Card No."),
            // );

            // if (idx >= 0) {
            //   jobCardColumnIndex = idx;
            //   headerRowIndex = i;
            //   break;
            // }

            cells.forEach((cell, idx) => {
              const text = cell.innerText.trim();

              if (jobCardColumnIndex === -1 && text.includes("Job Card No.")) {
                jobCardColumnIndex = idx;
                headerRowIndex = i;
              }

              if (blockColumnIndex === -1 && text.includes("Block Name")) {
                blockColumnIndex = idx;
              }
            });

            if (jobCardColumnIndex !== -1 && blockColumnIndex !== -1) {
              break;
            }
          }

          if (jobCardColumnIndex === -1) {
            return {
              allPanchayats: [],
              error: "Job Card column not found",
            };
          }

          const panchayats = new Set();
          const blockNames = new Set();

          // Process only rows AFTER header
          for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i];

            const cells = [...row.querySelectorAll("td")];

            if (cells.length === 0 || jobCardColumnIndex >= cells.length) {
              continue;
            }

            const text = cells[jobCardColumnIndex]?.innerText?.trim();

            if (!text) {
              continue;
            }

            const lines = text
              .split("\n")
              .map((x) => x.trim())
              .filter(Boolean);

            if (lines.length < 2) {
              continue;
            }

            // Panchayat will be everything after first line
            let panchayat = lines.slice(1).join(" ");

            panchayat = panchayat.trim();

            if (panchayat.startsWith("(") && panchayat.endsWith(")")) {
              panchayat = panchayat.slice(1, -1).trim();
            }

            // Skip accidental header text
            if (/^panchayat\s*name$/i.test(panchayat)) {
              continue;
            }

            panchayats.add(panchayat);

            if (blockColumnIndex >= 0 && blockColumnIndex < cells.length) {
              const blockName = cells[blockColumnIndex]?.innerText?.trim();

              if (blockName && !/^block\s*name$/i.test(blockName)) {
                blockNames.add(blockName);
              }
            }
          }

          return {
            allPanchayats: [...panchayats],
            allBlocks: [...blockNames],
          };
        });

        console.log(data);

        if (data.allPanchayats.length > 1) {
          console.warn(
            `${record.ftoNo} has multiple Panchayats`,
            data.allPanchayats,
          );
        }

        results.push({
          ...record,
          allPanchayats: data.allPanchayats,
          blockName: data.allBlocks[0] || "",
        });
      } catch (error) {
        console.error(`Failed: ${record.ftoNo}`, error.message);

        results.push({
          ...record,
          allPanchayats: [],
          error: error.message,
        });
      }
    }

    // Save progress after each chunk
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), "utf8");

    console.log(`Saved progress: ${results.length}/${records.length}`);
  }

  console.log(`Completed. Output: ${outputFile}`);
});
