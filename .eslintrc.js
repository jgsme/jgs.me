module.exports = {
  env: {
    es6: true,
    node: true,
    browser: true
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended"
  ],
  plugins: [
    "@typescript-eslint",
    "react",
    "react-hooks"
  ],
  rules: {
    "@typescript-eslint/explicit-function-return-type": "off",
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off"
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json"
  },
  settings: {
    react: {
      version: "detect"
    }
  }
}
