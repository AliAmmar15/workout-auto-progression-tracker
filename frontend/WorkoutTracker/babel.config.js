module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Some dependencies ship import.meta usage that can break in non-module parsing paths.
          unstable_transformImportMeta: true,
        },
      ],
    ],
  };
};
