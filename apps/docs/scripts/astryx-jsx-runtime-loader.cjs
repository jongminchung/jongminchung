"use strict";

const ASTRYX_DEVELOPMENT_RUNTIME = "react/jsx-dev-runtime";
const REACT_PRODUCTION_RUNTIME = "react/jsx-runtime";
const ASTRYX_DEVELOPMENT_FACTORY = "jsxDEV as _jsxDEV";
const REACT_PRODUCTION_FACTORY = "jsx as _jsxDEV";

module.exports = function replaceAstryxJsxRuntime(source) {
  return source
    .replaceAll(ASTRYX_DEVELOPMENT_FACTORY, REACT_PRODUCTION_FACTORY)
    .replaceAll(ASTRYX_DEVELOPMENT_RUNTIME, REACT_PRODUCTION_RUNTIME);
};
