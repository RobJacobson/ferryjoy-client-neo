module.exports = (api) => {
  api.cache(true);
  const plugins = [];

  // Add React Compiler plugin first for optimal processing
  plugins.push("babel-plugin-react-compiler");
  plugins.push("react-native-worklets/plugin");

  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],

    plugins,
  };
};
