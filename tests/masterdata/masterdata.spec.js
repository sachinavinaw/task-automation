import { test, expect } from "@playwright/test";
import fs from "fs";
import XLSX from "xlsx-js-style";

import { logger } from "../../utils/logger.js";
import { BLOCK_NAME } from "../../config/config.js";

test("Download block and panchayat data", async ({ page }) => {
  test.setTimeout(180000); // 3 minutes
  logger.info(`Executing test for block and panachayat data download`);

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

  // Wait for any link containing blockName text
  const blockNameLink = page.locator("a").filter({
    hasText: BLOCK_NAME.BAGAHA_I,
  });

  await expect(blockNameLink.first()).toBeVisible({
    timeout: 120000,
  });

  await page.pause();

  // Click blockName
  await blockNameLink.first().click();

  // Wait for next page
  await page.waitForLoadState("domcontentloaded");

  // Wait for the Panchayats table to be visible
  const panchayatTable = page.locator("#ctl00_ContentPlaceHolder1_gvpanch");
  await expect(panchayatTable).toBeVisible({ timeout: 120000 });

  // Get all panchayat links
  const panchayatLinks = panchayatTable.locator("a");
  const count = await panchayatLinks.count();
  logger.info(`Found ${count} panchayats to process.`);

  // Re-query the link by index in each iteration to avoid stale element references
  const link = panchayatTable.locator("a").nth(0);
  const panchayatName = (await link.textContent())?.trim();
  logger.info(`Processing panchayat [${0 + 1}/${count}]: ${panchayatName}`);

  // Click the panchayat link
  await link.click();
  await page.waitForLoadState("domcontentloaded");

  await page.pause();

  for (let i = 0; i < count; i++) {
    // Re-query the link by index in each iteration to avoid stale element references
    const link = panchayatTable.locator("a").nth(i);
    const panchayatName = (await link.textContent())?.trim();
    logger.info(`Processing panchayat [${i + 1}/${count}]: ${panchayatName}`);

    // Click the panchayat link
    await link.click();
    await page.waitForLoadState("domcontentloaded");

    // TODO: Add any specific extraction or interaction logic here for the panchayat page

    // Navigate back to the block/panchayats list page
    await page.goBack();
    await page.waitForLoadState("domcontentloaded");

    // Ensure the panchayat table is visible again before proceeding to the next item
    await expect(panchayatTable).toBeVisible({ timeout: 120000 });
  }

  // await page.pause();
});
