var path = require('path');

function typesMatch(a, b) {
	return (typeof a === typeof b) && (Array.isArray(a) === Array.isArray(b));
}

var util = module.exports = {
	home: process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE,
	loadConfig: function () {
		var finalConfig = {};
		try {
			var userConfig = require(path.resolve(util.home, '.FindServers.json'));
		} catch (e) {
			return require('./config');
		}

		finalConfig = util.merge(userConfig, require('./config'));

		return finalConfig;
	},
	// https://github.com/remy/nodemon/blob/master/lib/utils/merge.js
	merge: function (one, two) {
		var result = one;
		Object.getOwnPropertyNames(two).forEach(function (key) {
			if (one[key] === undefined) {
				result[key] = two[key];
			}
		});

		Object.getOwnPropertyNames(one).forEach(function (key) {
			var value = one[key];

			if (two[key] && typesMatch(value, two[key])) {
				if (value === '') {
					result[key] = two[key];
				}

				if (Array.isArray(value)) {
					if (value.length === 0 && two[key].length) {
						result[key] = two[key].slice(0);
					}
				} else if (typeof value === "object") {
					result[key] = util.merge(value, two[key]);
				}
			}
		});

	  return result;
	}
}