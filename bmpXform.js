'use strict';

// Node packages
var fs = require('fs');
var os = require('os');

// local packages
var colorXform = require('./color_transform');

var _closure = function() {

  var errMsg_fileCorrupt = function(name) {
    return console.log("Error: " + name + " is corrupt or truncated");
  };

  var resolveEndianness = function(buf) {
    // os.endianness() is new in 0.10.0 - figure it out by hand if necessary
    var le = ((os.endianness? os.endianness() : function() {
      var raw = new ArrayBuffer(4);
      var chars = new Uint8Array(raw);
      var word = new Uint32Array(raw);
      chars[0] = 0x11; chars[1] = 0x22; chars[2] = 0x33; chars[3] = 0x44;
      return word[0] === 0x44332211? 'LE' : 'BE';
    }()) === "LE");

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

  // get command-line arguments
  var args = {};
  for (var ix = 2; ix < process.argv.length; ix++) {
    if (process.argv[ix][0] === "-") {
      if (process.argv[ix].length > 1) {
        args["xform"] = process.argv[ix][1].toUpperCase();
      }
    }
    else {
      args["inFileName"] = process.argv[ix];
    }
  }
  var inFileName = args["inFileName"];
  var xformer = colorXform(args["xform"]);

  var file = fs.readFile(inFileName, function(err, data) {
    if (err) return console.log("Error: " + err.code +
                                " - can't handle '" + inFileName + "'");

    var fileSize = fs.statSync(inFileName).size;

    var readBuf = resolveEndianness(data);

    var imgHeader = function() {
      var FILETYPE_OFFSET = 0;
      var FILESIZE_OFFSET = 2;
      var IMGSTART_OFFSET = 10;

      if (fileSize > IMGSTART_OFFSET)
      {
        return {
          "imgType": readBuf.Char(FILETYPE_OFFSET, 2).toString(),
          "imgFileSize": readBuf.Long(FILESIZE_OFFSET),
          "imgDataOffset": readBuf.Long(IMGSTART_OFFSET)
        };
      }
    }();

    if (!imgHeader || imgHeader.fileSize != fileSize)  // don't let's overrun the end of file
      return errMsg_fileCorrupt(inFileName + ' header');

    var imgMetaData;

    switch (imgHeader.imgType) {
      case 'BM':
        imgMetaData = function() {
          var HDRSIZE_OFFSET = 14;
          var IMG_WIDTH_OFFSET = 18;
          var IMG_HEIGHT_OFFSET = 22;
          var BITS_PER_PIXEL_OFFSET = 28;
          var COLOR_COUNT_OFFSET = 46;

          if (IMG_WIDTH_OFFSET > fileSize)
            return errMsg_fileCorrupt(inFileName + " image header");

          var hdrSize = readBuf.Long(HDRSIZE_OFFSET);
          if (hdrSize + HDRSIZE_OFFSET > fileSize)
            return errMsg_fileCorrupt(inFileName + " metadata");

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
        return console.log("Unhandled image type: " + imgHeader.imgType);
        break;
    }

      if (imgMetaData) {
      var RED = 2; var GREEN = 1; var BLUE = 0;
      if (imgMetaData.bitsPerPixel === 8 && imgMetaData.paletteSize > 0) {
        if (imgMetaData.paletteStart > fileSize ||
            imgHeader.imgDataOffset > fileSize)
          return errMsg_fileCorrupt(inFileName + " palette data");

        // color-transform the palette data
        var pal = data.slice(imgMetaData.paletteStart, imgHeader.imgDataOffset);
        var paletteEntryWidth = 4;
        for (var ix = 0; ix < pal.length; ix += paletteEntryWidth) {
          var oldPixel = {
            "r": pal[ix + RED],
            "g": pal[ix + GREEN],
            "b": pal[ix + BLUE]
          };
          var newPixel = xformer.xformFunction(oldPixel);
          pal[ix + RED] = newPixel.r;
          pal[ix + GREEN] = newPixel.g;
          pal[ix + BLUE] = newPixel.b;
        };
      }
      else {
        // color-transform image pixels in place
        var pixelWidth = imgMetaData.bitsPerPixel / 8;
        var imgDataWidth = imgMetaData.imgWidth * pixelWidth;
        if (imgDataWidth % 4) { // pad data rows if necessary
          imgDataWidth += (4 - imgDataWidth % 4);
        }
        if (imgHeader.imgDataOffset > fileSize || data.length > fileSize)
          return errMsg_fileCorrupt(inFileName + " image data");

        var img = data.slice(imgHeader.imgDataOffset, data.length);
        for (var rx = 0; rx < imgMetaData.imgHeight; rx++) {
          var row = rx * imgDataWidth;
          for (var col = 0; col < imgDataWidth; col += pixelWidth) {
            oldPixel = {
              "r": img[row + col + RED],
              "g": img[row + col + GREEN],
              "b": img[row + col + BLUE]
            };
            newPixel = xformer.xformFunction(oldPixel);
            img[row + col + RED] = newPixel.r;
            img[row + col + GREEN] = newPixel.g;
            img[row + col + BLUE] = newPixel.b;
          }
        }
      }
      // write modified image file
      var outFileName = "BX" + inFileName;
      fs.writeFile(outFileName, data, function(err) {
        if (err) return console.log(err);
      });
    }
  });   // fileRead callback
}();  // program closure
