var path = require('path')
var colors = require('colors')
var fs = require('fs')

function typesMatch(a, b) {
  return (typeof a === typeof b) && (Array.isArray(a) === Array.isArray(b))
}

var util = module.exports = {
  home: process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE,
  loadConfig: function () {
    var configPath = path.resolve(util.home, '.sift.json')
    var config = require('./config')
    var finalConfig = {};
    if (fs.existsSync(configPath)) {
      try {
        var userConfig = require(configPath)
      } catch (e) {
        console.log('Could not load user config, please correct the syntax of %s in your home directory'.red, configPath)
        return null
      }
      if (JSON.stringify(config) == JSON.stringify(userConfig)) {
        console.log('Please update the default configuration in %s'.red, configPath)
        return null
      }
    } else {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf8')
      console.log('Please update the default configuration in %s'.red, configPath)
      return null
    }

    finalConfig = util.merge(userConfig, config)

    return finalConfig
  },
  // https://github.com/remy/nodemon/blob/master/lib/utils/merge.js
  merge: function (one, two) {
    var result = one
    Object.getOwnPropertyNames(two).forEach(function (key) {
      if (one[key] === undefined) {
        result[key] = two[key]
      }
    });

    Object.getOwnPropertyNames(one).forEach(function (key) {
      var value = one[key]

      if (two[key] && typesMatch(value, two[key])) {
        if (value === '') {
          result[key] = two[key]
        }

        if (Array.isArray(value)) {
          if (value.length === 0 && two[key].length) {
            result[key] = two[key].slice(0)
          }
        } else if (typeof value === "object") {
          result[key] = util.merge(value, two[key])
        }
      }
    });

    return result;
  },
  contains: function (match, array) {
    for (var i in array) {
      if (array[i] === match) {
        return true
      }
    }
    return false
  },
  containsWithLowercase: function (match, array) {
    for (var i in array) {
      if (array[i].toLowerCase() === match) {
        return true
      }
    }
    return false
  },
  ssh: function (server, user, port, keyfile, options) {
    require('child_process').spawn('ssh', ['-tt', user + '@' + (port ? server.hostname + ':' + port : server.hostname)], { stdio: 'inherit' })
  },
  display: function (server, index) {
    console.log('(%s) %s - %s [%s] [%s] [%s] [%s]', (index), colors.green(server.account.name), colors.blue(server.account.type), colors.green(server.name), colors.cyan(server.image), colors.yellow(server.hostname), colors.red(server.region))
  }
}