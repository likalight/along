import { readFileSync, writeFileSync, cpSync, mkdirSync } from "node:fs";
const raw = readFileSync(
  new URL("../catalog/data/catalog.json", import.meta.url),
  "utf8",
);
JSON.parse(raw);
writeFileSync(
  new URL("../backend/src/agreed-data.generated.ts", import.meta.url),
  "// Generated from catalog/data/catalog.json. Do not hand edit.\nexport const agreedData: any = " +
    raw +
    ";\n",
);
writeFileSync(
  new URL("../packages/contract/src/catalog.generated.ts", import.meta.url),
  "// Generated from catalog/data/catalog.json by scripts/sync-catalog.mjs. Do not hand edit.\nexport const agreedCatalog: any = " +
    raw +
    ";\n",
);
mkdirSync(new URL("../apps/web/public/catalog", import.meta.url), {
  recursive: true,
});
cpSync(
  new URL("../catalog/public/catalog/images", import.meta.url),
  new URL("../apps/web/public/catalog/images", import.meta.url),
  { recursive: true },
);

mkdirSync(new URL("../backend/public/catalog", import.meta.url), {
  recursive: true,
});
cpSync(
  new URL("../catalog/public/catalog/images", import.meta.url),
  new URL("../backend/public/catalog/images", import.meta.url),
  { recursive: true },
);
