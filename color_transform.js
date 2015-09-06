'use strict';
var xform = module.exports = exports = function(xformCode) {
  var xNull = function(colIn) {
      return colIn;
    };

  var xInvert = function(colIn) {
    return {
      "r": 255 - colIn.r,
      "g": 255 - colIn.g,
      "b": 255 - colIn.b
    };
  };

  var xGrayscale = function(colIn) {
    var gray = Math.floor(colIn.r * 0.3 + colIn.g * 0.6 + colIn.b * 0.1);
    return {
      "r": gray,
      "g": gray,
      "b": gray
    };
  };

  var xRotate = function(colIn) {
    return {
      "r": colIn.g,
      "g": colIn.b,
      "b": colIn.r
    };
  };

  var xformName = "";
  var xformFunc = null;
  switch (xformCode) {
    case 'G':
      xformName = "Grayscale";
      xformFunc = xGrayscale;
      break;
    case 'I':
      xformName = "Invert";
      xformFunc = xInvert;
      break;
    case 'N':
      xformName = "No Transform";
      xformFunc = xNull;
      break;
    case 'R':
      xformName = "Rotate";
      xformFunc = xRotate;
      break;
    default:
      console.log("Unknown option: " + xformCode);
      break;
  }

  return { "xformFunction": xformFunc, "xformName": xformName };
};
