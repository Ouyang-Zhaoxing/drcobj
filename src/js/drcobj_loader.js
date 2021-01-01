/**
 * @author Blinking / https://blinking.fun/
 * 
 * MIT License
 * 
 * Copyright (c) 2019-2020 Blinking
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * 
 */

THREE.DrcobjLoader = (function () {

  function DrcobjLoader(manager) {
    this.manager = (manager !== undefined) ? manager : THREE.DefaultLoadingManager;
  }

  DrcobjLoader.prototype.setPath = function (value) { this.path = value; };
  DrcobjLoader.prototype.setResourcePath = function (value) { this.resourcePath = value; };
  DrcobjLoader.prototype.setDecoderPath = function (value) { this.decoderPath = value; };

  DrcobjLoader.prototype.load = function (url, onLoad, onProgress, onDecodeProgress, onError) {

    var self = this;

    var path = (this.path === undefined) ? extractUrlBase(url) : this.path;
    this.resourcePath = this.resourcePath || path;

    var fileLoader = new THREE.FileLoader(self.manager);
    fileLoader.setPath(self.path);
    fileLoader.setResponseType("arraybuffer");

    fileLoader.load(url, function (buffer) { self.parse(buffer, onLoad, onDecodeProgress); }, onProgress, onError);

  };

  DrcobjLoader.prototype.parse = function (buffer, onLoad, onDecodeProgress, isInflate) {

    var self = this;

    if (self.objectLoader === undefined) { self.objectLoader = new THREE.ObjectLoader(); }
    self.objectLoader.setResourcePath(this.resourcePath);

    if (self.dracoLoader === undefined) {
      self.dracoLoader = new THREE.DRACOLoader();
      self.dracoLoader.setDecoderPath(self.decoderPath);
      self.dracoLoader.setDecoderConfig({ type: "wasm" });
      self.dracoLoader.setWorkerLimit(8);
    }

    if (isInflate) { buffer = (new Zlib.Inflate(new Uint8Array(buffer))).decompress().buffer; }

    var modelDataSize = (new Uint32Array(buffer, 0, 1))[0];
    var modelData = new Uint8Array(buffer, 4, modelDataSize);
    var jsonData = JSON.parse(THREE.LoaderUtils.decodeText(modelData));

    var geometryBufferStart, geometryBufferEnd, geometryBuffer, finishCount = 0;
    var geometriesDataOffset = 4 + modelDataSize;

    function decode(i) {

      geometryBufferStart = geometriesDataOffset + jsonData.geometries[i].data.offset;
      geometryBufferEnd = geometryBufferStart + jsonData.geometries[i].data.byteLength;
      geometryBuffer = buffer.slice(geometryBufferStart, geometryBufferEnd);

      self.dracoLoader.decodeDracoFile(geometryBuffer, function (geometry) {
        jsonData.geometries[i].data = geometry.toJSON().data; ++finishCount;
        if (onDecodeProgress) { onDecodeProgress(finishCount / jsonData.geometries.length * 100); }
        if (finishCount === jsonData.geometries.length) {

          if (onLoad) { // 通常情况下 OnLoad 是必须存在的
            onLoad(self.objectLoader.parse(jsonData));
          }

        }
      });

    }

    for (var i = 0; i < jsonData.geometries.length; i++) { decode(i); }

  };

  DrcobjLoader.prototype.dispose = function () { this.dracoLoader.dispose(); };

  var extractUrlBase = function (url) {
    var index = url.lastIndexOf("/");
    if (index === - 1) { return "./"; } return url.substr(0, index + 1);
  };

  return DrcobjLoader;

})();
