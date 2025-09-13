module.exports = {
  overrides: [
    {
      files: ["*.test.ts", "*.test.js", "**/tests/**/*.ts", "**/tests/**/*.js"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/ban-ts-comment": "off",
      },
    },
  ],
};
