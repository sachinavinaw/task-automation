import path from "path";
import dotenv from "dotenv";

dotenv.config({
  path: path.resolve(process.cwd(), ".env.dev"),
});

export const FINACIAL_YEAR = {
  "2026_2027": "2026-2027",
  "2025_2026": "2025-2026",
  "2024_2025": "2024-2025",
  "2023_2024": "2023-2024",
  "2022_2023": "2022-2023",
};

export const BLOCK_NAME = {
  NAUTAN: "NAUTAN",
  CHANPATIA: "CHANPATIA",
  BAGAHA_I: "BAGAHA-I",
  BAGAHA_II: "BAGAHA-II",
  BAIRIA: "BAIRIA",
  BETTIAH: "BETTIAH",
  BHITAHA: "BHITAHA",
  CHANPATIA: "CHANPATIA",
  GAUNAHA: "GAUNAHA",
  JOGAPATTI: "JOGAPATTI",
  LAURIYA: "LAURIYA",
  MADHUBANI: "MADHUBANI",
  MAINATAND: "MAINATAND",
  MAJHAULIA: "MAJHAULIA",
  NARKATIAGANJ: "NARKATIAGANJ",
  NAUTAN: "NAUTAN",
  PIPRASI: "PIPRASI",
  RAMNAGAR: "RAMNAGAR",
  SIKTA: "SIKTA",
  THAKRAHAN: "THAKRAHAN",
};

const blockName = BLOCK_NAME[process.env.BLOCK_NAME] || BLOCK_NAME.CHANPATIA;

const financialYear =
  FINACIAL_YEAR[process.env.FINANCIAL_YEAR] || FINACIAL_YEAR["2026_2027"];

export const ACTIVE_FTO_REPORT = {
  BLOCK_NAME: blockName,
  FINACIAL_YEAR: financialYear,
};
