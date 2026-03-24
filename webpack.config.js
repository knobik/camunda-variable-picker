const CamundaModelerWebpackPlugin = require('camunda-modeler-webpack-plugin');
const path = require('path');

module.exports = {
  mode: 'development',
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'client.js'
  },
  devtool: 'cheap-module-source-map',
  resolve: {
    alias: {
      '@bpmn-io/properties-panel': 'camunda-modeler-plugin-helpers/vendor/@bpmn-io/properties-panel'
    }
  },
  plugins: [
    new CamundaModelerWebpackPlugin({
      // Only use react config — handles React alias + JSX for .js files
      // PanelRenderer.js uses h() directly so no JSX transform needed there
      type: 'react'
    })
  ]
};
