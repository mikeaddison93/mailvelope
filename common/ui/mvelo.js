
/**
 * Mailvelope - secure email with OpenPGP encryption for Webmail
 * Copyright (C) 2012  Thomas Oberndörfer
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/* jshint strict: false */

var mvelo = mvelo || {};
// chrome extension
mvelo.crx = typeof chrome !== 'undefined';
// firefox addon
mvelo.ffa = mvelo.ffa || typeof self !== 'undefined' && self.port || !mvelo.crx;
// for fixfox, mvelo.extension is exposed from a content script
mvelo.extension = mvelo.extension || mvelo.crx && chrome.runtime;
// extension.connect shim for Firefox
if (mvelo.ffa && mvelo.extension) {
  mvelo.extension.connect = function(obj) {
    mvelo.extension._connect(obj);
    obj.events = {};
    var port = {
      postMessage: mvelo.extension.port.postMessage,
      disconnect: mvelo.extension.port.disconnect.bind(null, obj),
      onMessage: {
        addListener: mvelo.extension.port.addListener.bind(null, obj)
      }
    };
    // page unload triggers port disconnect
    window.addEventListener('unload', port.disconnect);
    return port;
  };
}

mvelo.appendTpl = function($element, path) {
  if (mvelo.ffa && !/^resource/.test(document.location.protocol)) {
    return new Promise(function(resolve, reject) {
      mvelo.data.load(path, function(result) {
        $element.append($.parseHTML(result));
        resolve($element);
      });
    });
  } else {
    return new Promise(function(resolve, reject) {
      var req = new XMLHttpRequest();
      req.open('GET', path);
      req.responseType = 'text';
      req.onload = function() {
        if (req.status == 200) {
          $element.append($.parseHTML(req.response));
          resolve($element);
        } else {
          reject(new Error(req.statusText));
        }
      };
      req.onerror = function() {
        reject(new Error("Network Error"));
      };
      req.send();
    });
  }
};

// for fixfox, mvelo.l10n is exposed from a content script
mvelo.l10n = mvelo.l10n || mvelo.crx && {
  getMessages: function(ids, callback) {
    var result = {};
    ids.forEach(function(id) {
      result[id] = chrome.i18n.getMessage(id);
    });
    callback(result);
  },
  localizeHTML: function(l10n) {
    $('[data-l10n-id]').each(function() {
      var jqElement = $(this);
      var id = jqElement.data('l10n-id');
      var text = l10n ? l10n[id] : chrome.i18n.getMessage(id);
      jqElement.text(text);
    });
  }
};
// min height for large frame
mvelo.LARGE_FRAME = 600;
// frame constants
mvelo.FRAME_STATUS = 'stat';
// frame status
mvelo.FRAME_ATTACHED = 'att';
mvelo.FRAME_DETACHED = 'det';
// key for reference to frame object
mvelo.FRAME_OBJ = 'fra';
// marker for dynamically created iframes
mvelo.DYN_IFRAME = 'dyn';
mvelo.IFRAME_OBJ = 'obj';
// armor header type
mvelo.PGP_MESSAGE = 'msg';
mvelo.PGP_SIGNATURE = 'sig';
mvelo.PGP_PUBLIC_KEY = 'pub';
mvelo.PGP_PRIVATE_KEY = 'priv';
// editor mode
mvelo.EDITOR_WEBMAIL = 'webmail';
mvelo.EDITOR_EXTERNAL = 'external';
mvelo.EDITOR_BOTH = 'both';
// display decrypted message
mvelo.DISPLAY_INLINE = 'inline';
mvelo.DISPLAY_POPUP = 'popup';
// editor type
mvelo.PLAIN_TEXT = 'plain';
mvelo.RICH_TEXT = 'rich';

mvelo.util = {};

mvelo.util.sortAndDeDup = function(unordered, compFn) {
  var result = [];
  var prev = -1;
  unordered.sort(compFn).forEach(function(item) {
    var equal = (compFn !== undefined && prev !== undefined) ? compFn(prev, item) === 0 : prev === item;
    if (!equal) {
      result.push(item);
      prev = item;
    }
  });
  return result;
};

// random hash generator
mvelo.util.getHash = function() {
  var result = '';
  var buf = new Uint16Array(6);
  if (typeof window !== 'undefined') {
    window.crypto.getRandomValues(buf);
  } else {
    mvelo.util.getDOMWindow().crypto.getRandomValues(buf);
  }
  for (var i = 0; i < buf.length; i++) {
    result += buf[i].toString(16);
  }
  return result;
};

mvelo.util.encodeHTML = function(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\//g, "&#x2F;");
};

mvelo.util.decodeQuotedPrint = function(armored) {
  return armored
    .replace(/=3D=3D\s*$/m, "==")
    .replace(/=3D\s*$/m, "=")
    .replace(/=3D(\S{4})\s*$/m, "=$1");
};

mvelo.util.getExtensionClass = function(fileExt) {
  var extClass = "";
  if (fileExt !== undefined) {
    extClass = "ext-color-" + fileExt;
  }
  return extClass;
};

mvelo.util.extractFileNameWithoutExt = function(fileName) {
  var indexOfDot = fileName.lastIndexOf(".");
  if (indexOfDot > 0) { // case: regular
    return fileName.substring(0, indexOfDot);
  } else if (indexOfDot === 0) { // case ".txt"
    return "";
  } else {
    return fileName;
  }
};

mvelo.util.extractFileExtension = function(fileName) {
  var lastindexDot = fileName.lastIndexOf(".");
  if (lastindexDot < 0) { // no extension
    return "";
  } else {
    return fileName.substring(lastindexDot + 1, fileName.length).toLowerCase().trim();
  }
};

mvelo.util.Timer = function(interval) {
  this.interval = interval;
  this.timeoutID = 0;
};

mvelo.util.Timer.prototype.start = function() {
  if (this.timeoutID) {
    clearTimeout(this.timeoutID);
  }
  this.timeoutID = setTimeout(function() {
    mvelo.timeoutID = 0;
  }, this.interval);
};

mvelo.util.Timer.prototype.isOn = function() {
  return this.timeoutID !== 0;
};

mvelo.util.Timer.prototype.isOff = function() {
  return this.timeoutID === 0;
};

if (typeof exports !== 'undefined') {
  exports.mvelo = mvelo;
}
