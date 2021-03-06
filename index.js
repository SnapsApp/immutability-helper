/* eslint-disable */
var invariant = require('invariant');

var hasOwnProperty = Object.prototype.hasOwnProperty;
var splice = Array.prototype.splice;

function assign(target, source) {
  for (var key in source) {
    if (hasOwnProperty.call(source, key)) {
      target[key] = source[key];
    }
  }
  return target;
}

function copy(object) {
  if (object instanceof Array) {
    return object.slice();
  } else if (object && typeof object === 'object') {
    return assign(new object.constructor(), object);
  } else {
    return object;
  }
}

function forceObjToArray(obj) {
  if (!Array.isArray(obj) && typeof obj === 'object' && !isNaN(parseInt(Object.keys(obj)[0], 10))) {
    var newArr = [];
    for (var key in obj) {
      var keyNum = parseInt(key, 10);
      newArr[keyNum] = obj[key];
    }
    return newArr;
  }
  return obj;
}


function newContext() {
  var commands = assign({}, defaultCommands);
  update.extend = function(directive, fn) {
    commands[directive] = fn;
  }

  return update;

  function update(object, spec) {
    invariant(
      !Array.isArray(spec),
      'update(): You provided an invalid spec to update(). The spec may ' +
      'not contain an array except as the value of $set, $push, $unshift, ' +
      '$splice or any custom command allowing an array value.'
    );

    invariant(
      typeof spec === 'object' && spec !== null,
      'update(): You provided an invalid spec to update(). The spec and ' +
      'every included key path must be plain objects containing one of the ' +
      'following commands: %s.',
      Object.keys(commands).join(', ')
    );

    var newObject = object;
    for (var key in spec) {
      if (hasOwnProperty.call(commands, key)) {
        return commands[key](spec[key], newObject, spec, object);
      }
    }
    for (var key in spec) {
      var nextValueForKey = update(object[key], spec[key]);
      if (nextValueForKey === object[key]) {
        continue;
      }
      if (newObject === object) {
        newObject = copy(object);
      }
      newObject[key] = nextValueForKey;
    }
    return newObject;
  }

}

var defaultCommands = {
  $push: function(value, original, spec) {
    value = forceObjToArray(value);
    spec.$push = forceObjToArray(spec.$push);
    invariantPushAndUnshift(original, spec, '$push');
    return original.concat(value);
  },
  $unshift: function(value, original, spec) {
    invariantPushAndUnshift(original, spec, '$unshift');
    return value.concat(original);
  },
  $splice: function(value, newObject, spec, object) {
    var originalValue = newObject === object ? copy(object) : newObject;
    invariantSplices(originalValue, spec);
    value.forEach(function(args) {
      invariantSplice(args);
      splice.apply(originalValue, args);
    });
    return originalValue;
  },
  $move: function(value, newObject, spec, object) {
    var originalValue = newObject === object ? copy(object) : newObject;
    invariantSplice(value);
    var swapValue = newObject[value[0]];
    splice.apply(originalValue, [value[0], 1]);
    splice.apply(originalValue, [value[1], 0, swapValue]);
    return originalValue;
  },
  $set: function(value, original, spec) {
    invariantSet(spec);
    return value;
  },
  $merge: function(value, newObject, spec, object) {
    var originalValue = newObject === object ? copy(object) : newObject;
    invariantMerge(originalValue, value);
    Object.keys(value).forEach(function(key) {
      originalValue[key] = value[key];
    });
    return originalValue;
  },
  $apply: function(value, original) {
    invariantApply(value);
    return value(original);
  }
};



module.exports = newContext();
module.exports.newContext = newContext;


// invariants

function invariantPushAndUnshift(value, spec, command) {
  invariant(
    Array.isArray(value),
    'update(): expected target of %s to be an array; got %s.',
    command,
    value
  );
  var specValue = spec[command];
  invariant(
    Array.isArray(specValue),
    'update(): expected spec of %s to be an array; got %s. ' +
    'Did you forget to wrap your parameter in an array?',
    command,
    specValue
  );
}

function invariantSplices(value, spec) {
  invariant(
    Array.isArray(value),
    'Expected $splice target to be an array; got %s',
    value
  );
  invariantSplice(spec['$splice']);
}

function invariantSplice(value) {
  invariant(
    Array.isArray(value),
    'update(): expected spec of $splice to be an array of arrays; got %s. ' +
    'Did you forget to wrap your parameters in an array?',
    value
  );
}

function invariantApply(fn) {
  invariant(
    typeof fn === 'function',
    'update(): expected spec of $apply to be a function; got %s.',
    fn
  );
}

function invariantSet(spec) {
  invariant(
    Object.keys(spec).length === 1,
    'Cannot have more than one key in an object with $set'
  );
}

function invariantMerge(target, specValue) {
  invariant(
    specValue && typeof specValue === 'object',
    'update(): $merge expects a spec of type \'object\'; got %s',
    specValue
  );
  invariant(
    target && typeof target === 'object',
    'update(): $merge expects a target of type \'object\'; got %s',
    target
  );
}
