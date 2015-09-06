'use strict';

var colorXform = require('../color_transform');

var expect = require('chai').expect;

describe('colorXform', function() {
  it('should handle known transform codes', function() {
    expect(colorXform("G").xformName).to.eql('Grayscale');
    expect(colorXform("R").xformName).to.eql('Rotate');
    expect(colorXform("I").xformName).to.eql('Invert');
    expect(colorXform("N").xformName).to.eql('No Transform');
  });
  it('should handle unknown transform codes', function() {
    expect(colorXform('@').xformName).to.eql('');
    expect(colorXform('@').xformFunction).to.eql(null);
  });
});
