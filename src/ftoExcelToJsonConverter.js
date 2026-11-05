import { readFtoExcel, saveJsonToFile } from "../utils/excelUtils.js";
import fs from "fs";
import { ACTIVE_FTO_REPORT } from "../config/config.js";

const targetBlockName = ACTIVE_FTO_REPORT.BLOCK_NAME;
const targetFinancialYear = ACTIVE_FTO_REPORT.FINACIAL_YEAR;

const records = readFtoExcel(
  `${process.cwd()}/data/block/${targetBlockName}/${targetFinancialYear}/excel/FTO_Report.xlsx`,
);

const outputDir = `${process.cwd()}/data/block/${targetBlockName}/${targetFinancialYear}/json`;

fs.mkdirSync(outputDir, {
  recursive: true,
});

saveJsonToFile(records, `${outputDir}/FTO_Report.json`);
