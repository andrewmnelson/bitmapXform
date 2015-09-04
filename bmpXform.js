'use strict';

// Node packages
var fs = require('fs');
var os = require('os');

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

// get command-line arguments
var args = {};
for (var ix = 2; ix < process.argv.length; ix++) {
  if (process.argv[ix][0] === "-") {
    if (process.argv[ix].length > 1) {
      args["xform"] = process.argv[ix][1].toUpperCase();
      switch (args.xform) {
        case 'G':
          args["xformFunc"] = xGrayscale;
          break;
        case 'I':
          args["xformFunc"] = xInvert;
          break;
        case 'R':
          args["xformFunc"] = xRotate;
          break;
        default:
          return console.log("Unknown option: " + args.xform);
          break;
      }
    }
  }
  else {
    args["inFileName"] = process.argv[ix];
  }
}
var inFileName = args["inFileName"];

var resolveEndianness = function(buf) {
  var le = true;  // os.endianness() is new in 0.10.0 - figure it out by hand
  var raw = new ArrayBuffer(4);
  var chars = new Uint8Array(raw);
  var word = new Uint32Array(raw);
  chars[0] = 0xA1; chars[1] = 0xB2; chars[2] = 0xC3; chars[3] = 0xD4;
  le = word[0] === 0xD4C3B2A1;
  return {
    "Char": function (offset, size) {
        return buf.slice(offset, size);
      },
    "Word": function (offset) {
        return le? buf.readUInt16LE(offset) : buf.readUInt16BE(offset);
      },
    "Long": function (offset) {
        return le? buf.readUInt32LE(offset) : buf.readUInt32BE(offset);
      }
  };
};

var file = fs.readFile(inFileName, function(err, data) {
  if (err) return console.log("Error: " + err.code + " - can't handle '" + inFileName + "'");

  var fileSize = fs.statSync(inFileName).size;  // check vs. header-reported size

  var readBuf = resolveEndianness(data);

  var imgHeader = function() {
    var FILETYPE_OFFSET = 0;
    var FILESIZE_OFFSET = 2;
    var IMGSTART_OFFSET = 10;

    return {
      "imgType": readBuf.Char(FILETYPE_OFFSET, 2).toString(),
      "imgFileSize": readBuf.Long(FILESIZE_OFFSET),
      "imgDataOffset": readBuf.Long(IMGSTART_OFFSET)
    };
  }();

  var imgMetaData;

  switch (imgHeader.imgType) {
    case 'BM':
      imgMetaData = function() {
        var HDRSIZE_OFFSET = 14;
        var IMG_WIDTH_OFFSET = 18;
        var IMG_HEIGHT_OFFSET = 22;
        var BITS_PER_PIXEL_OFFSET = 28;
        var COLOR_COUNT_OFFSET = 46;

        var hdrSize = readBuf.Long(HDRSIZE_OFFSET);
        var bpp = readBuf.Word(BITS_PER_PIXEL_OFFSET);
        var cc = readBuf.Long(COLOR_COUNT_OFFSET);
        return {
          "hdrSize":      hdrSize,
          "imgWidth":     readBuf.Long(IMG_WIDTH_OFFSET),
          "imgHeight":    readBuf.Long(IMG_HEIGHT_OFFSET),
          "bitsPerPixel": bpp,
          "colorCount":   cc,
          "paletteStart": HDRSIZE_OFFSET + hdrSize,
          "paletteSize":  4 * cc
        };
      }();
      break;
    default:
      console.log("Unhandled image type: " + imgHeader.imgType);
      break;
  }

  if (imgMetaData) {
    var RED = 2; var GREEN = 1; var BLUE = 0;
    if (imgMetaData.bitsPerPixel === 8 && imgMetaData.paletteSize > 0) {
      // color-transform the palette data
      var pal = data.slice(imgMetaData.paletteStart, imgHeader.imgDataOffset);
      var paletteEntryWidth = 4;
      for (var ix = 0; ix < pal.length; ix += paletteEntryWidth) {
        var oldPixel = {
          "r": pal[ix + RED],
          "g": pal[ix + GREEN],
          "b": pal[ix + BLUE]
        };
        var newPixel = args.xformFunc(oldPixel);
        pal[ix + RED] = newPixel.r;
        pal[ix + GREEN] = newPixel.g;
        pal[ix + BLUE] = newPixel.b;
      };
    }
    else {
      console.log(imgMetaData);
      // color-transform image pixels in place
      var pixelWidth = imgMetaData.bitsPerPixel / 8;
      var imgDataWidth = imgMetaData.imgWidth * pixelWidth;
      if (imgDataWidth % 4) { // pad data rows if necessary
        imgDataWidth += (4 - imgDataWidth % 4);
      var imgDataSize = imgDataWidth * imgMetaData.imgHeight;
      }
      var img = data.slice(imgHeader.imgDataOffset, data.length);
      for (var rx = 0; rx < imgMetaData.imgHeight; rx++) {
        var row = rx * imgDataWidth;
        for (var col = 0; col < imgDataWidth * pixelWidth; col += pixelWidth) {
          oldPixel = {
            "r": img[row + col + RED],
            "g": img[row + col + GREEN],
            "b": img[row + col + BLUE]
          };
          newPixel = args.xformFunc(oldPixel);
          img[row + col + RED] = newPixel.r;
          img[row + col + GREEN] = newPixel.g;
          img[row + col + BLUE] = newPixel.b;
        }
      }
    }
    // write modified image file
    var outFileName = "BX" + inFileName;
    fs.writeFile(outFileName, data, function(err) {
      if (err) console.log(err);
    });
  }
  else {
    console.log("Error: can't read image metadata.")
  }
});
