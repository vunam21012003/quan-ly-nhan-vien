module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier", // kết hợp với prettier
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": ["warn"],
    "no-console": "off",
  },
};
