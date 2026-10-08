import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";

export default [
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { react, "react-hooks": reactHooks },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.flat.recommended.rules,
      // react-hooks v7 の recommended は React Compiler 向けの新しい静的解析ルール
      // （static-components, set-state-in-effect 等）まで含み、既存コードの構造を
      // 広範に変更しないと通らないため、ここでは昔からある基本2ルールのみ有効化する。
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react/prop-types": "off", // UIコンポーネント（.jsx）は未型付けで、型チェックに依存していないため
      "react/react-in-jsx-scope": "off", // React 17+ の新JSXトランスフォームを使用
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      // 日本語UI文言で視覚的な位置合わせに使う全角スペースを許可する
      // （JSXテキスト・文字列リテラル内の意図的な全角スペースを誤検知しないようにする）
      "no-irregular-whitespace": ["error", { skipJSXText: true, skipStrings: true, skipTemplates: true }],
    },
  },
  {
    // 計算ロジック（rates.ts/calc.ts/format.ts/utils.ts）はTypeScript化済み（#43）。
    // 型チェック自体はtsc（npm run typecheck）が担うため、ここではTS構文のパースと
    // 基本的なlintルールのみ有効化する。
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      "no-unused-vars": "off", // tscのnoUnusedLocals相当はtypecheckで別途担保
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];
