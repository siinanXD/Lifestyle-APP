import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [...nextCoreWebVitals, ...nextTypescript, { ignores: [".next/", "supabase/"] }];

export default config;
