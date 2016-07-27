function toArray(args) {
  return Array.prototype.slice.apply(args);
}
function SynchronousPromise(ctorFunction) {
  this.status = 'pending';
  this._next = [];
  var self = this;
  var doCatch = function(args) {
    self._catchData = toArray(args);
    self._applyCatch();
  }
  ctorFunction(function() {
    self._data = toArray(arguments);
    var doResolve = function() {
      self.status = 'resolved';
      self._applyNext();
    }
    if (self._looksLikePromise(self._data[0])) {
      self._data[0].then(function() {
        self._data = toArray(arguments);
        doResolve();
      }).catch(function(e) {
        self._catchData = toArray(arguments);
        self._applyCatch();
      })
    } else {
      doResolve();
    }
  }, function() {
    self.status = 'rejected'; // TODO: cleanup double-set
    self._catchData = toArray(arguments);
    self._applyCatch();
  })
}
SynchronousPromise.prototype = {
  then: function(next) {
    this._next.push(next);
    if (this.status === 'resolved') {
      this._applyNext();
    }
    return this;
  },
  _applyNext: function() {
    if (!this._next) {
      return;
    }
    try {
      var next = this._next.shift();
      if (!next) {
        return;
      }
      var data = next.apply(null, this._data);
      var self = this;
      if (this._looksLikePromise(data)) {
        data.then(function() {
          self._data = Array.prototype.slice.apply(arguments);
          self._applyNext();
        })
      } else {
        this._data = [data];
        this._applyNext();
      }
    } catch (e) {
      this._next = [];
      this._data = undefined;
      this._catchData = [e];
      this._applyCatch();
    }
  },
  _looksLikePromise: function(thing) {
    return thing &&
            thing['then'] &&
            typeof(thing['then']) === 'function';
  },
  catch: function(fn) {
    this._catchFunction = fn;
    this._applyCatch();
    return this;
  },
  _applyCatch: function() {
    var 
      catchFunction = this._catchFunction,
      catchData = this._catchData;
    if (!(catchFunction && catchData)) {
      return; // nyom
    }
    this.status = 'rejected';
    this._next = [];
    this._data = undefined;
    catchFunction.apply(null, catchData);
  },
};
SynchronousPromise.resolve = function() {
  var args = arguments;
  return new SynchronousPromise(function(resolve, reject) {
    resolve.apply(null, toArray(args));
  });
};
SynchronousPromise.reject = function() {
  var args = arguments;
  return new SynchronousPromise(function(resolve, reject) {
    reject.apply(null, toArray(args));
  });
};
SynchronousPromise.all = function() {
  var args = toArray(arguments);
  return new SynchronousPromise(function(resolve, reject) {
    var
      allData = [],
      doResolve = function() {
        if (allData.length === args.length) {
          resolve(allData);
        }
      },
      rejected = false,
      doReject = function(err) {
        if (rejected) {
          return;
        }
        rejected = true;
        reject(err);
      };
    args.forEach(function(arg) {
      arg.then(function(thisResult) {
        allData.push(thisResult);
        doResolve();
      }).catch(function(err) {
        doReject(err);
      });
    });
  });
};
module.exports = {
  SynchronousPromise: SynchronousPromise
}
