import { test, expect } from "@playwright/test";
import fs from "fs";
import XLSX from "xlsx-js-style";

import { ACTIVE_FTO_REPORT } from "../../config/config.js";
import { logger } from "../../utils/logger.js";

const targetBlockName = ACTIVE_FTO_REPORT.BLOCK_NAME;
const targetFinancialYear = ACTIVE_FTO_REPORT.FINACIAL_YEAR;

test("[MATERIAL] Download FTO Report for block", async ({ page }) => {
  test.setTimeout(180000); // 3 minutes
  logger.info(
    `Executing test for block: [${targetBlockName}] and financial year: [${targetFinancialYear}]`,
  );
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

  const ftoStatusReportLink = page.locator("a").filter({
    hasText: "FTO Status Report",
  });

  await ftoStatusReportLink.click();

  // Wait for the FTO table
  await expect(page.locator("text=FTO Generated at Block Level")).toBeVisible({
    timeout: 120000,
  });

  // Click on material radio button
  await page.locator('input[type="radio"][value="M"]').check();

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
  logger.debug(`2nd Signatory Signed FTO Count:${count}`);

  await secondSignatorySignedFtoLink.click();

  await expect(page.locator("text=FTO Second Signatory")).toBeVisible({
    timeout: 120000,
  });

  // await page.pause();
});
