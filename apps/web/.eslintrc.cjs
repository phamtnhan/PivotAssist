module.exports = {
  root: true,
  extends: ["next/core-web-vitals"],
  ignorePatterns: [".next/", "e2e/", "node_modules/", "playwright.config.ts"],
  rules: {
    // Known debt: hook identity / locale copy in existing pages; errors still fail the gate.
    "react-hooks/exhaustive-deps": "warn",
    "@next/next/no-img-element": "warn",
  },
};
